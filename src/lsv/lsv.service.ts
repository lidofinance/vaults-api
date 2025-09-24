import { Hex, Address } from 'viem';
import { Inject, Injectable } from '@nestjs/common';
import { iterateUrls } from '@lidofinance/rpc';
import { createPDGProof, ValidatorWitnessWithWC } from '@lidofinance/lsv-cli/dist/utils/proof';
import {
  getVaultReport,
  getReportProofByVault,
  type VaultReport as VaultReportCliType,
} from '@lidofinance/lsv-cli/dist/utils/report';
import { fetchIPFS, type Report } from '@lidofinance/lsv-cli/dist/utils';
import { calculateRebaseReward, type CalculateRebaseRewardArgs } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';
import { calculateHealth, type CalculateHealthArgs } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';
import { reportMetrics, type ReportMetricsArgs } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';

import { PrometheusService } from 'common/prometheus';
import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ReportEntity, ReportLeafEntity } from 'db/report-db';

export const VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR = 'VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR';

@Injectable()
export class LsvService {
  constructor(
    protected readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  private async _createProof(
    validatorIndex: number,
    clApiUrl: string,
  ): Promise<ValidatorWitnessWithWC | typeof VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR> {
    // TODO: Rename or refactor the metric associated with _createProof,
    //  since createPDGProof performs multiple requests to the CL API.
    // const endTimer = this.prometheusService.clApiRequestDuration.startTimer();
    try {
      const proof = await createPDGProof(validatorIndex, clApiUrl);
      // endTimer({ result: 'success' });
      return proof;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`ValidatorIndex ${validatorIndex} out of range`)) {
        // endTimer({ result: 'error' });
        console.warn(`[LsvService.createProof] Validator index ${validatorIndex} is out of range`);
        return VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR;
      }

      console.error(`[LsvService.createProof] Failed to create PDG proof for validatorIndex ${validatorIndex}:`, error);
      throw error;
    }
  }

  public async createProof(
    validatorIndex: number,
  ): Promise<ValidatorWitnessWithWC | typeof VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR> {
    return await iterateUrls(this.configService.clApiUrls, (url) => this._createProof(validatorIndex, url));
  }

  private async _fetchIPFS(cid: string, gateway: string): Promise<Report> {
    const endTimer = this.prometheusService.ipfsRequestDuration.startTimer();
    try {
      const report = await fetchIPFS<Report>(
        {
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
      endTimer({ result: 'success', gateway });
      return report;
    } catch (error) {
      endTimer({ result: 'error', gateway });
      this.logger.error(`[LsvService._fetchIPFS] Failed to fetch IPFS report (cid: ${cid}): ${error.message}`);
      throw error;
    }
  }

  public async fetchIPFS(cid: string): Promise<Report> {
    return await iterateUrls(this.configService.ipfsGateways, (url) => this._fetchIPFS(cid, url));
  }

  private async _getVaultReport(vault: Address, cid: string, gateway: string): Promise<VaultReportCliType> {
    try {
      return await getVaultReport(
        {
          vault,
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
    } catch (error) {
      this.logger.error(
        `[LsvService._getVaultReport] Failed to get vault report (vault: ${vault}, cid: ${cid}): ${error.message}`,
      );
      throw error;
    }
  }

  public async getVaultReport(vault: Address, cid: string): Promise<VaultReportCliType> {
    return await iterateUrls(this.configService.ipfsGateways, (url) => this._getVaultReport(vault, cid, url));
  }

  private async _getReportProofByVault(
    vault: Address,
    cid: string,
    gateway: string,
  ): Promise<(VaultReportCliType & { proof: Hex[] }) | null> {
    try {
      return await getReportProofByVault(
        {
          vault,
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
    } catch (error) {
      // This is the behavior of the CLI
      if (error.message?.toLowerCase().includes(`vault ${vault.toLowerCase()} not found in report`)) {
        this.logger.warn(`[LsvService._getReportProofByVault] ${error.message}`);
        return null;
      }

      this.logger.error(
        `[LsvService._getReportProofByVault] Failed to get vault report and proof (vault: ${vault}, cid: ${cid}): ${error.message}`,
      );
      throw error;
    }
  }

  public async getReportProofByVault(
    vault: Address,
    cid: string,
  ): Promise<(VaultReportCliType & { proof: Hex[] }) | null> {
    return await iterateUrls(this.configService.ipfsGateways, (url) => this._getReportProofByVault(vault, cid, url));
  }

  public async calculateHealth(args: CalculateHealthArgs): Promise<ReturnType<typeof calculateHealth>> {
    return calculateHealth({ ...args });
  }

  public async calculateRebaseReward(args: CalculateRebaseRewardArgs): Promise<bigint> {
    return calculateRebaseReward({ ...args });
  }

  public async calcReportMetrics(args: ReportMetricsArgs): Promise<ReturnType<typeof reportMetrics>> {
    return reportMetrics({ ...args });
  }

  public static transformToVaultReportCli(report: ReportEntity, leaf: ReportLeafEntity): VaultReportCliType {
    return {
      data: {
        vaultAddress: leaf.vaultAddress,
        totalValueWei: leaf.totalValueWei,
        fee: leaf.fee,
        liabilityShares: leaf.liabilityShares,
        maxLiabilityShares: leaf.maxLiabilityShares,
        slashingReserve: leaf.slashingReserve,
      },
      extraData: {
        inOutDelta: leaf.inOutDelta,
        prevFee: leaf.prevFee,
        infraFee: leaf.infraFee,
        liquidityFee: leaf.liquidityFee,
        reservationFee: leaf.reservationFee,
      },
      leaf: report.tree[leaf.treeIndex],
      refSlot: report.refSlot,
      blockNumber: report.blockNumber,
      timestamp: report.timestamp,
      prevTreeCID: report.prevTreeCID,
      // todo
      cid: '',
    };
  }
}

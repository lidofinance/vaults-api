import { Hex } from 'viem';
import { Inject, Injectable } from '@nestjs/common';

import { iterateUrls } from '@lidofinance/rpc';
import { createPDGProof, ValidatorWitnessWithWC } from '@lidofinance/lsv-cli/dist/utils/proof';
import { type VaultReport as VaultReportCliType, type VaultReportArgs } from '@lidofinance/lsv-cli/dist/utils/report';
import { getVaultReport, getReportProofByVault } from '@lidofinance/lsv-cli/dist/utils/report';
import { fetchIPFS as fetchIPFSCli, type Report } from '@lidofinance/lsv-cli/dist/utils';
import { calculateRebaseReward, type CalculateRebaseRewardArgs } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';
import { calculateHealth, type CalculateHealthArgs } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';
import { reportMetrics, type ReportMetricsArgs } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';

import { ReportEntity, ReportLeafEntity } from 'db/report-db';
import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';

export const VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR = 'VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR';

@Injectable()
export class LsvService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  public async createProof(
    validatorIndex: number,
  ): Promise<ValidatorWitnessWithWC | typeof VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR> {
    try {
      // TODO: add fallback
      return await createPDGProof(validatorIndex, this.configService.get('CL_API_URLS')[0]);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`ValidatorIndex ${validatorIndex} out of range`)) {
        console.warn(`[LsvService.createProof] Validator index ${validatorIndex} is out of range`);
        return VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR;
      }

      console.error(`[LsvService.createProof] Failed to create PDG proof for validatorIndex ${validatorIndex}:`, error);
      throw error;
    }
  }

  private async _fetchIPFS(cid: string, gateway: string): Promise<Report> {
    try {
      return await fetchIPFSCli(
        {
          cid,
          gateway,
          bigNumberType: 'string',
        },
        false,
      );
    } catch (error) {
      this.logger.error(`[LsvService._fetchIPFS] Error fetching IPFS Report by cid: ${cid}: ${error.message}`);
      throw error;
    }
  }

  public async fetchIPFS(cid: string): Promise<Report> {
    // TODO
    const urls: [string, ...string[]] = [this.configService.get('IPFS_GATEWAY')];

    return await iterateUrls(urls, (url) => this._fetchIPFS(cid, url));
  }

  public async getVaultReport(args: VaultReportArgs): Promise<VaultReportCliType> {
    return await getVaultReport(args, false);
  }

  public async getReportProofByVault(args: VaultReportArgs): Promise<(VaultReportCliType & { proof: Hex[] }) | null> {
    try {
      return await getReportProofByVault(args, false);
    } catch (error) {
      // This is the behavior of the CLI
      if (error.message?.toLowerCase().includes(`vault ${args.vault.toLowerCase()} not found in report`)) {
        return null;
      }

      throw error;
    }
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
    };
  }
}

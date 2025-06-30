import { Injectable } from '@nestjs/common';

import { createPDGProof, ValidatorWitnessWithWC } from '@lidofinance/lsv-cli/dist/utils/proof';
import { type VaultReport as VaultReportCliType, type VaultReportArgs } from '@lidofinance/lsv-cli/dist/utils/report';
import { getVaultReport, getVaultReportProofByCid } from '@lidofinance/lsv-cli/dist/utils/report';
import { fetchAndVerifyFile } from '@lidofinance/lsv-cli/dist/utils/ipfs';
import { calculateRebaseReward } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';
import { calculateHealth } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';
import { reportMetrics } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';

import { ReportEntity, ReportLeafEntity } from 'report';
import { ConfigService } from 'common/config';

export const VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR = 'VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR';

@Injectable()
export class LsvService {
  constructor(protected readonly configService: ConfigService) {}

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

  public async getVaultReport(args: VaultReportArgs): Promise<VaultReportCliType> {
    return await getVaultReport(args);
  }

  public async getVaultReportProofByCid(
    args: VaultReportArgs,
    cache?: boolean,
  ): Promise<ReturnType<typeof getVaultReportProofByCid>> {
    return getVaultReportProofByCid(args, cache);
  }

  public async fetchAndVerifyFile(reportCid: string): Promise<Uint8Array> {
    return await fetchAndVerifyFile(reportCid, this.configService.get('IPFS_GATEWAY'));
  }

  public async calculateHealth(
    // TODO: get CalculateHealthArgs from '@lidofinance/lsv-cli/dist/utils/health/calculate-health'
    totalValue: bigint,
    liabilitySharesInStethWei: bigint,
    forceRebalanceThresholdBP: number,
  ): Promise<ReturnType<typeof calculateHealth>> {
    return calculateHealth({
      totalValue,
      liabilitySharesInStethWei,
      forceRebalanceThresholdBP,
    });
  }

  public async calculateRebaseReward(
    // TODO: get CalculateHealthArgs from '@lidofinance/lsv-cli/dist/utils/rebase-rewards'
    shareRatePrev: bigint,
    shareRateCurr: bigint,
    prevLeafLiabilityShares: bigint,
    currLeafLiabilityShares: bigint,
  ): Promise<bigint> {
    return calculateRebaseReward({
      shareRatePrev,
      shareRateCurr,
      sharesPrev: prevLeafLiabilityShares,
      sharesCurr: currLeafLiabilityShares,
    });
  }

  public async calcReportMetrics(
    // TODO: get ReportMetricsArgs from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic'
    currentVaultReport: VaultReportCliType,
    previousVaultReport: VaultReportCliType,
    nodeOperatorFeeRate: bigint,
    rebaseReward: bigint,
  ): Promise<ReturnType<typeof reportMetrics>> {
    return reportMetrics({
      reports: { current: currentVaultReport, previous: previousVaultReport },
      nodeOperatorFeeRate,
      stEthLiabilityRebaseRewards: rebaseReward,
    });
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
      },
      // TODO
      leaf: '',
      refSlot: report.refSlot,
      blockNumber: report.blockNumber,
      timestamp: report.timestamp,
      // TODO
      proofsCID: '',
      prevTreeCID: report.prevTreeCID,
      merkleTreeRoot: report.merkleTreeRoot,
    };
  }
}

import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

import { reportMetrics } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';
import { type VaultReport as VaultReportCliType } from '@lidofinance/lsv-cli/dist/utils/report';
import { calculateRebaseReward } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { ReportEntity, ReportLeafEntity, ReportService } from 'report';
import { VaultsService } from 'vault';
import { VaultsStateHourlyService, VaultReportStatsService } from 'vaults-state-hourly';

@Injectable()
export class ReportStatisticJobsService {
  private readonly BATCH_SIZE = 100;
  private nodeOperatorFeeRateByVault = new Map<string, bigint>();

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LIDO_CONTRACT_TOKEN) private readonly lidoContract: Lido,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly reportService: ReportService,
    private readonly vaultsService: VaultsService,
    private readonly vaultReportStatsService: VaultReportStatsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportStatisticJobsService initialization started');
    // ...
    this.logger.log('ReportStatisticJobsService initialization finished');
  }

  async calculate(): Promise<void> {
    let skip = 0;
    let previousReport: ReportEntity | null = null;
    let previousLeaves: ReportLeafEntity[] | null = null;

    while (true) {
      const batch = await this.reportService.getAllReportsSortedDesc(skip, this.BATCH_SIZE);
      if (batch.length === 0) break;

      // batch = [report5, report4, report3, report2, report1] (new → old)
      // ordered = [report1, report2, report3, report4, report5] (old → new)
      const ordered = batch.reverse();
      for (const currentReport of ordered) {
        const currentLeaves = await this.reportService.getLeavesByReport(currentReport);

        // skip first iteration, because previousReport = undefined, currentReport = report1
        // last iteration: previousReport = report4, currentReport = report5
        if (previousReport && previousLeaves) {
          this.logger.log(
            `Calculating metrics for report pair: previous=${previousReport.cid}, current=${currentReport.cid}`,
          );
          await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);
          this.logger.log(
            `Finished calculating metrics for report pair: previous=${previousReport.cid}, current=${currentReport.cid}`,
          );
        }

        previousReport = currentReport;
        previousLeaves = currentLeaves;
      }

      skip += this.BATCH_SIZE;
    }

    this.logger.log('All reports statistic calculation complete!');
  }

  private async calculateForVaultsBasedPrevReport(
    currentReport: ReportEntity,
    previousReport: ReportEntity,
    currentLeaves: ReportLeafEntity[],
    previousLeaves: ReportLeafEntity[],
  ) {
    const previousLeavesByVaultAddress = new Map(previousLeaves.map((leaf) => [leaf.vaultAddress, leaf]));
    const currentLeavesByVaultAddress = new Map(currentLeaves.map((leaf) => [leaf.vaultAddress, leaf]));

    const shareRatePrev = await this.calculateShareRate(previousReport.blockNumber);
    const shareRateCurr = await this.calculateShareRate(currentReport.blockNumber);

    for (const [vaultAddress, prevLeaf] of previousLeavesByVaultAddress.entries()) {
      const currLeaf = currentLeavesByVaultAddress.get(vaultAddress);
      if (!currLeaf) continue;

      const currentVaultReport = ReportStatisticJobsService.toVaultReportCliTyping(currentReport, currLeaf);
      const previousVaultReport = ReportStatisticJobsService.toVaultReportCliTyping(previousReport, prevLeaf);

      // nodeOperatorFeeRate cache
      let nodeOperatorFeeRate: bigint;
      if (this.nodeOperatorFeeRateByVault.has(vaultAddress)) {
        nodeOperatorFeeRate = this.nodeOperatorFeeRateByVault.get(vaultAddress);
      } else {
        const vaultState = await this.vaultsStateHourlyService.getByVaultAddress(vaultAddress);
        nodeOperatorFeeRate = BigInt(vaultState?.nodeOperatorFeeRate ?? 0);
        this.nodeOperatorFeeRateByVault.set(vaultAddress, nodeOperatorFeeRate);
      }

      const rebaseReward = calculateRebaseReward({
        shareRatePrev,
        shareRateCurr,
        sharesPrev: BigInt(prevLeaf.liabilityShares),
        sharesCurr: BigInt(currLeaf.liabilityShares),
      });

      const metrics = reportMetrics({
        reports: { current: currentVaultReport, previous: previousVaultReport },
        nodeOperatorFeeRate,
        stEthLiabilityRebaseRewards: rebaseReward,
      });

      const vaultDbEntity = await this.vaultsService.getOrCreateVaultByAddress(vaultAddress);

      await this.vaultReportStatsService.addOrUpdate({
        vault: vaultDbEntity,
        currentReport,
        previousReport,
        rebaseReward: rebaseReward.toString(),
        grossStakingRewards: metrics.grossStakingRewards.toString(),
        nodeOperatorRewards: metrics.nodeOperatorRewards.toString(),
        dailyLidoFees: metrics.dailyLidoFees.toString(),
        netStakingRewards: metrics.netStakingRewards.toString(),
        grossStakingAPR: metrics.grossStakingAPR.apr.toString(),
        grossStakingAprBps: metrics.grossStakingAPR.apr_bps,
        grossStakingAprPercent: metrics.grossStakingAPR.apr_percent,
        netStakingAPR: metrics.netStakingAPR.apr.toString(),
        netStakingAprBps: metrics.netStakingAPR.apr_bps,
        netStakingAprPercent: metrics.netStakingAPR.apr_percent,
        bottomLine: metrics.bottomLine.toString(),
        efficiencyAPR: metrics.efficiency.apr.toString(),
        efficiencyAprBps: metrics.efficiency.apr_bps,
        efficiencyAprPercent: metrics.efficiency.apr_percent,
        updatedAt: new Date(),
      });

      this.logger.log(`Saved report metrics for ${vaultAddress}`);
    }
  }

  private static toVaultReportCliTyping(report: ReportEntity, leaf: ReportLeafEntity): VaultReportCliType {
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

  private async totalSupply(blockNumber: number) {
    return (await this.lidoContract.totalSupply({ blockTag: blockNumber })).toBigInt();
  }

  private async totalShares(blockNumber: number) {
    return (await this.lidoContract.getTotalShares({ blockTag: blockNumber })).toBigInt();
  }

  // https://github.com/lidofinance/lido-staking-vault-cli/blob/develop/utils/share-rate.ts
  private calculateShareRate = async (blockNumber: number): Promise<bigint> => {
    const [totalSupply, totalShares] = await Promise.all([
      this.totalSupply(blockNumber),
      this.totalShares(blockNumber),
    ]);

    return totalShares !== 0n ? (totalSupply * 10n ** 27n) / totalShares : 0n;
  };
}

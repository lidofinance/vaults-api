import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { reportMetrics } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';
import { calculateRebaseReward } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { ReportEntity, ReportLeafEntity, ReportService } from 'report';

@Injectable()
export class ReportStatisticJobsService {
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LIDO_CONTRACT_TOKEN) private readonly lidoContract: Lido,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly reportService: ReportService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportStatisticJobsService initialization started');
    // ...
    this.logger.log('ReportStatisticJobsService initialization finished');
  }

  async calculate(): Promise<void> {
    let skip = 0;
    let previousReport: ReportEntity | null = null;
    let previousLeaves: Awaited<ReturnType<ReportService['getLeavesByReport']>> | null = null;

    while (true) {
      const batch = await this.reportService.getAllReportsSortedDesc(skip, this.BATCH_SIZE);
      if (batch.length === 0) break;

      const ordered = batch.reverse();

      for (const currentReport of ordered) {
        const currentLeaves = await this.reportService.getLeavesByReport(currentReport);

        if (previousReport && previousLeaves) {
          await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);

          // this.logger.log(`Calculated vault statistics for reports: ${previousReport.cid} -> ${currentReport.cid}`);
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

      const currentVaultReport = ReportStatisticJobsService.toVaultReport(currentReport, currLeaf);
      const previousVaultReport = ReportStatisticJobsService.toVaultReport(previousReport, prevLeaf);

      const rebaseReward = calculateRebaseReward({
        shareRatePrev,
        shareRateCurr,
        sharesPrev: BigInt(prevLeaf.liabilityShares),
        sharesCurr: BigInt(currLeaf.liabilityShares),
      });

      const metrics = reportMetrics({
        reports: { current: currentVaultReport, previous: previousVaultReport },
        nodeOperatorFeeRate: 10n, // TODO
        stEthLiabilityRebaseRewards: rebaseReward,
      });

      this.logger.debug(`Vault: ${vaultAddress}`);
      this.logger.debug(`- grossStakingRewards: ${metrics.grossStakingRewards}`);
      this.logger.debug(`- nodeOperatorRewards: ${metrics.nodeOperatorRewards}`);
      this.logger.debug(`- dailyLidoFees: ${metrics.dailyLidoFees}`);
      this.logger.debug(`- netStakingRewards: ${metrics.netStakingRewards}`);
      this.logger.debug(`- grossStakingAPR.apr: ${metrics.grossStakingAPR.apr}`);
      this.logger.debug(`- grossStakingAPR.apr_bps: ${metrics.grossStakingAPR.apr_bps}`);
      this.logger.debug(`- grossStakingAPR.apr_percent: ${metrics.grossStakingAPR.apr_percent}`);
      this.logger.debug(`- netStakingAPR.apr: ${metrics.netStakingAPR.apr}`);
      this.logger.debug(`- netStakingAPR.apr_bps: ${metrics.netStakingAPR.apr_bps}`);
      this.logger.debug(`- netStakingAPR.apr_percent: ${metrics.netStakingAPR.apr_percent}`);
      this.logger.debug(`- bottomLine: ${metrics.bottomLine}`);
      this.logger.debug(`- efficiency.apr: ${metrics.efficiency.apr}`);
      this.logger.debug(`- efficiency.apr_bps: ${metrics.efficiency.apr_bps}`);
      this.logger.debug(`- efficiency.apr_percent: ${metrics.efficiency.apr_percent}`);
      this.logger.debug(``);
    }
  }

  private static toVaultReport(report: ReportEntity, leaf: ReportLeafEntity) {
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
      leaf: leaf.id.toString(), // TODO
      refSlot: report.refSlot,
      blockNumber: report.blockNumber,
      timestamp: report.timestamp,
      proofsCID: report.cid,
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

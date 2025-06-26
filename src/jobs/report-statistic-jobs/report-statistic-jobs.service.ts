import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { getGrossStakingRewards } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { ReportService, ReportEntity, ReportLeafEntity } from 'report';

@Injectable()
export class ReportStatisticJobsService {
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
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

      for (const currReport of ordered) {
        const currLeaves = await this.reportService.getLeavesByReport(currReport);

        if (previousReport && previousLeaves) {
          this.calculateForVaultsBasedPrevReport(previousReport, currReport, previousLeaves, currLeaves);

          this.logger.log(`Calculated vault statistics for reports: ${previousReport.cid} -> ${currReport.cid}`);
        }

        previousReport = currReport;
        previousLeaves = currLeaves;
      }

      skip += this.BATCH_SIZE;
    }

    this.logger.log('All reports statistic calculation complete!');
  }

  private calculateForVaultsBasedPrevReport(
    previousReport: ReportEntity,
    currentReport: ReportEntity,
    previousLeaves: ReportLeafEntity[],
    currentLeaves: ReportLeafEntity[],
  ) {
    const previousLeavesByVaultAddress = new Map(previousLeaves.map((leaf) => [leaf.vaultAddress, leaf]));
    const currentLeavesByVaultAddress = new Map(currentLeaves.map((leaf) => [leaf.vaultAddress, leaf]));

    for (const [vaultAddress, prevLeaf] of previousLeavesByVaultAddress.entries()) {
      const currLeaf = currentLeavesByVaultAddress.get(vaultAddress);
      if (!currLeaf) continue;

      const currentVaultReport = ReportStatisticJobsService.toVaultReport(currentReport, currLeaf);
      const previousVaultReport = ReportStatisticJobsService.toVaultReport(previousReport, prevLeaf);

      const grossStakingRewards = getGrossStakingRewards(currentVaultReport, previousVaultReport);
      // getNodeOperatorRewards(cur, prev, nodeOperatorFeeBP)
      // getDailyLidoFees(cur, prev)
      // getNetStakingRewards(cur, prev, nodeOperatorFeeBP)
      // getAverageTotalValue(cur, prev)
      // getGrossStakingAPR(cur, prev)
      // getNetStakingAPR(cur, prev, nodeOperatorFeeBP)
      // getBottomLine(cur, prev, nodeOperatorFeeBP, stEthLiabilityRebaseRewards)
      // getEfficiency(cur, prev, nodeOperatorFeeBP, stEthLiabilityRebaseRewards)

      // reportMetrics({
      //   reports: { current: cur; previous: prev };
      //   nodeOperatorFeeRate: bigint;
      //   stEthLiabilityRebaseRewards: bigint;
      // })

      this.logger.debug(`Vault ${vaultAddress} gross rewards: ${grossStakingRewards.toString()}`);
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
}

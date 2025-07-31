import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ReportEntity, ReportLeafEntity, ReportDbService } from 'db/report-db';
import { VaultDbService } from 'db/vault-db';
import { LsvService } from 'lsv';

@Injectable()
export class ReportService {
  private nodeOperatorFeeRateByVault = new Map<string, bigint>();

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) private readonly lidoContract: Lido,
    private readonly lazyOracleContractService: LazyOracleContractService,
    private readonly reportDbService: ReportDbService,
    private readonly vaultDbService: VaultDbService,
    private readonly lsvService: LsvService,
  ) {}

  public async fetchAllReports(): Promise<void> {
    let cid: string | null = (await this.lazyOracleContractService.getLatestReportData()).reportCid;

    while (cid) {
      try {
        const reportData = await this.lsvService.fetchIPFS(cid);
        this.logger.log(`Fetched report for CID: ${cid}`);

        const report = await this.reportDbService.saveReport(cid, reportData);
        this.logger.log(`Saved the report for CID: ${cid}`);

        await this.reportDbService.saveLeaves(report, reportData);
        this.logger.log(`Saved leaves for CID: ${cid}`);

        cid = reportData.prevTreeCID && reportData.prevTreeCID.trim() !== '' ? reportData.prevTreeCID : null;
      } catch (error) {
        this.logger.error(`Failed to fetch/save report with CID: ${cid}`, error);
        return;
      }
    }

    this.logger.log(`Report fetching complete!`);
  }

  public async calculate(): Promise<void> {
    const batchSize = this.configService.jobs['reportBatchSize'];
    let skip = 0;
    let previousReport: ReportEntity | null = null;
    let previousLeaves: ReportLeafEntity[] | null = null;

    while (true) {
      const batch = await this.reportDbService.getAllReportsSortedDesc(skip, batchSize);
      if (batch.length === 0) break;

      // batch = [report5, report4, report3, report2, report1] (new → old)
      // ordered = [report1, report2, report3, report4, report5] (old → new)
      const ordered = batch.reverse();
      for (const currentReport of ordered) {
        const currentLeaves = await this.reportDbService.getLeavesByReport(currentReport);

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

      skip += batchSize;
    }

    this.logger.log('All reports statistic calculation complete!');
  }

  public subscribeToEvents() {
    this.logger.log('[subscribeToEvents, event:VaultsReportDataUpdated] Subscribing to VaultsReportDataUpdated event');

    this.lazyOracleContractService.contract.on(
      'VaultsReportDataUpdated',
      async (timestamp: bigint, root: string, cid: string, event) => {
        this.logger.log(
          `[subscribeToEvents, event:VaultsReportDataUpdated] Event received: timestamp=${timestamp}, root=${root}, cid=${cid}, block=${event.blockNumber}`,
        );

        try {
          const reportData = await this.lsvService.fetchIPFS(cid);
          this.logger.log(`[subscribeToEvents, event:VaultsReportDataUpdated] Fetched report for CID: ${cid}`);

          const report = await this.reportDbService.saveReport(cid, reportData);
          this.logger.log(`[subscribeToEvents, event:VaultsReportDataUpdated] Saved the report for CID: ${cid}`);

          await this.reportDbService.saveLeaves(report, reportData);
          this.logger.log(`[subscribeToEvents, event:VaultsReportDataUpdated] Saved leaves for CID: ${cid}`);
        } catch (error) {
          this.logger.error(
            `[subscribeToEvents, event:VaultsReportDataUpdated] Failed to fetch/save report with CID: ${cid}`,
            error,
          );
        }
      },
    );
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

      const currentVaultReport = LsvService.transformToVaultReportCli(currentReport, currLeaf);
      const previousVaultReport = LsvService.transformToVaultReportCli(previousReport, prevLeaf);

      // nodeOperatorFeeRate cache
      let nodeOperatorFeeRate: bigint;
      if (this.nodeOperatorFeeRateByVault.has(vaultAddress)) {
        nodeOperatorFeeRate = this.nodeOperatorFeeRateByVault.get(vaultAddress);
      } else {
        const vaultState = await this.vaultDbService.getStateByVaultAddress(vaultAddress);
        nodeOperatorFeeRate = BigInt(vaultState?.nodeOperatorFeeRate ?? 0);
        this.nodeOperatorFeeRateByVault.set(vaultAddress, nodeOperatorFeeRate);
      }

      const rebaseReward = await this.lsvService.calculateRebaseReward({
        shareRatePrev,
        shareRateCurr,
        sharesPrev: BigInt(prevLeaf.liabilityShares),
        sharesCurr: BigInt(currLeaf.liabilityShares),
      });

      const metrics = await this.lsvService.calcReportMetrics({
        reports: {
          current: currentVaultReport,
          previous: previousVaultReport,
        },
        nodeOperatorFeeRate,
        stEthLiabilityRebaseRewards: rebaseReward,
      });

      const vaultDbEntity = await this.vaultDbService.getOrCreateVaultByAddress(vaultAddress);

      await this.vaultDbService.addOrUpdateReportStats({
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
        carrySpreadAPR: metrics.carrySpread.apr.toString(),
        carrySpreadAprBps: metrics.carrySpread.apr_bps,
        carrySpreadAprPercent: metrics.carrySpread.apr_percent,
        updatedAt: new Date(),
      });

      this.logger.log(`Saved report metrics for ${vaultAddress}`);
    }
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

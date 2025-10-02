import { LRUCache } from 'lru-cache';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ReportEntity, ReportLeafEntity, ReportDbService } from 'db/report-db';
import { VaultDbService } from 'db/vault-db';
import { TrackJob } from 'common/job/track-job.decorator';
import { LsvService } from 'lsv';

@Injectable()
export class ReportService {
  private nodeOperatorFeeRateByVault = new Map<string, bigint>();
  private readonly shareRateCache: LRUCache<number, bigint>;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) private readonly lidoContract: Lido,
    private readonly lazyOracleContractService: LazyOracleContractService,
    private readonly reportDbService: ReportDbService,
    private readonly vaultDbService: VaultDbService,
    private readonly lsvService: LsvService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.shareRateCache = new LRUCache<number, bigint>({
      // Prevents recalculation of ShareRate (see this.calculateShareRate)
      // for `previousReport` and `currentReport` in 'calculateForVaultsBasedPrevReport'
      max: 2,
      // https://isaacs.github.io/node-lru-cache/interfaces/LRUCache.OptionsBase.html#ttl
      ttl: 0, // no time-based expiration, eviction only when max is exceeded
      // dedupe parallel requests of one blockNumber
      fetchMethod: async (blockNumber: number) => {
        const [totalSupply, totalShares] = await Promise.all([
          this.totalSupply(blockNumber),
          this.totalShares(blockNumber),
        ]);
        // https://github.com/lidofinance/lido-staking-vault-cli/blob/develop/utils/share-rate.ts
        return totalShares !== 0n ? (totalSupply * 10n ** 27n) / totalShares : 0n;
      },
    });
  }

  @TrackJob('fetchAllReports')
  public async fetchAllReports(): Promise<void> {
    const blockLimit = this.configService.get('START_REPORT_BLOCK_NUMBER');

    let fetchedCount = 0;
    let cid: string | null = (await this.lazyOracleContractService.getLatestReportData()).reportCid;

    while (cid) {
      try {
        const reportData = await this.lsvService.fetchIPFS(cid);
        this.logger.log(`[fetchAllReports] Fetched report for CID: ${cid}`);

        const report = await this.reportDbService.saveReport(cid, reportData);
        this.logger.log(`[fetchAllReports] Saved the report for CID: ${cid}`);

        await this.reportDbService.saveLeaves(report, reportData);
        this.logger.log(`[fetchAllReports] Saved leaves for CID: ${cid}`);

        fetchedCount++;
        cid = reportData.prevTreeCID && reportData.prevTreeCID.trim() !== '' ? reportData.prevTreeCID : null;

        if (blockLimit < 1 && fetchedCount >= 2) {
          this.logger.log(
            `[fetchAllReports] Stop fetching because 'START_REPORT_BLOCK_NUMBER' is not set (zero) or negative — fetching only the last 2 reports`,
          );
          break;
        }

        // safe for reportData.blockNumber:bigint
        if (blockLimit > Number(reportData.blockNumber)) {
          this.logger.log(
            `[fetchAllReports] Stop fetching because the 'START_REPORT_BLOCK_NUMBER' has been reached, report CID: ${cid}`,
          );
          break;
        }
      } catch (error) {
        this.logger.error(`[fetchAllReports] Failed to fetch/save report with CID: ${cid}`, error);
        return;
      }
    }

    this.logger.log(`[fetchAllReports] Report fetching complete, fetchedCount=${fetchedCount}!`);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'fetchAllReports', type: 'timestamp' })
      .set(Date.now() / 1000);
  }

  @TrackJob('calculateVaultMetrics')
  public async calculateVaultMetrics(): Promise<void> {
    const blockLimit = this.configService.get('START_REPORT_BLOCK_NUMBER');
    const batchSize = this.configService.jobs['reportBatchSize'];
    let skip = 0;
    let previousReport: ReportEntity | null = null;
    let previousLeaves: ReportLeafEntity[] | null = null;
    let calculatedCount = 0;

    reportFetchLoop: while (true) {
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
            `[calculateVaultMetrics] Calculating metrics for report pair: previous=${previousReport.cid}, current=${currentReport.cid}`,
          );
          await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);
          this.logger.log(
            `[calculateVaultMetrics] Finished calculating metrics for report pair: previous=${previousReport.cid}, current=${currentReport.cid}`,
          );
        }

        calculatedCount++;

        // 'calculatedCount >= 3' because the very first iteration has previousReport = null,
        // i.e. the first valid pair starts from the second report
        if (blockLimit < 1 && calculatedCount >= 3) {
          this.logger.log(
            `[calculateVaultMetrics] Stop calculating because 'START_REPORT_BLOCK_NUMBER' is not set (zero) or negative — calculating only the last 2 reports`,
          );
          break reportFetchLoop;
        }

        if (blockLimit > Number(currentReport.blockNumber)) {
          this.logger.log(
            `[calculateVaultMetrics] Stop calculating because 'START_REPORT_BLOCK_NUMBER' has been reached at report CID=${previousReport?.cid}`,
          );
          break reportFetchLoop;
        }

        previousReport = currentReport;
        previousLeaves = currentLeaves;
      }

      skip += batchSize;
    }

    this.logger.log(
      `[calculateVaultMetrics] Reports statistic calculation complete, calculatedCount=${calculatedCount}!`,
    );
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'calculateVaultMetrics', type: 'timestamp' })
      .set(Date.now() / 1000);
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
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultsReportDataUpdated', result: 'success' })
            .inc();
        } catch (error) {
          this.logger.error(
            `[subscribeToEvents, event:VaultsReportDataUpdated] Failed to fetch/save report with CID: ${cid}`,
            error,
          );
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultsReportDataUpdated', result: 'error' })
            .inc();
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

      this.logger.log(`[calculateForVaultsBasedPrevReport] Saved report metrics for ${vaultAddress}`);
    }
  }

  private async totalSupply(blockNumber: number): Promise<bigint> {
    return (await this.lidoContract.totalSupply({ blockTag: blockNumber })).toBigInt();
  }

  private async totalShares(blockNumber: number): Promise<bigint> {
    return (await this.lidoContract.getTotalShares({ blockTag: blockNumber })).toBigInt();
  }

  private calculateShareRate = async (blockNumber: number): Promise<bigint> => {
    return this.shareRateCache.fetch(blockNumber);
  };
}

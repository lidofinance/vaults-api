import { LRUCache } from 'lru-cache';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { LidoContractService } from 'common/contracts/modules/lido-contract';
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
    private readonly lidoContractService: LidoContractService,
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
      // tail sync
      if (await this.reportDbService.existsByCid(cid)) {
        this.logger.log(`[fetchAllReports] Stop fetching: CID already in DB (tail reached): ${cid}`);
        break;
      }

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
    let skipPagination = 0;
    let pairsCalculated = 0;

    // to pass along the "current" (newer one) between batches
    let currentReport: ReportEntity | null = null;
    let currentLeaves: ReportLeafEntity[] | null = null;

    reportFetchLoop: while (true) {
      // [new report -> ... -> old report ]
      const batch = await this.reportDbService.getAllReportsSortedDesc(skipPagination, batchSize);
      if (batch.length === 0) break;

      for (const previousReport of batch) {
        if (!currentReport) {
          // skip first iteration, because previousReport = undefined
          currentReport = previousReport;
          currentLeaves = await this.reportDbService.getLeavesByReport(currentReport);
          continue;
        }

        const previousLeaves = await this.reportDbService.getLeavesByReport(previousReport);

        this.logger.log(
          `[calculateVaultMetrics] Calculating metrics: current=${currentReport.cid}, previous=${previousReport.cid},`,
        );

        // Tail sync
        const reportStatsExist = await this.vaultDbService.existsAnyStatsForReportPair(
          previousReport.id,
          currentReport.id,
        );
        if (reportStatsExist) {
          this.logger.log(
            `[calculateVaultMetrics] Tail sync: pair already calculated current=${currentReport.cid}), (previous=${previousReport.cid}, calc by last 2 reports and stop!`,
          );
          // Any way calc by last 2 reports
          await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);
          break reportFetchLoop;
        }

        await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);

        pairsCalculated++;

        if (blockLimit < 1 && pairsCalculated >= 1) {
          this.logger.log(
            `[calculateVaultMetrics] Stop calculating because 'START_REPORT_BLOCK_NUMBER' is not set (zero) or negative — calculating only by last 2 reports`,
          );
          break reportFetchLoop;
        }
        if (blockLimit > Number(currentReport.blockNumber)) {
          this.logger.log(
            `[calculateVaultMetrics] Stop calculating because 'START_REPORT_BLOCK_NUMBER' has been reached at report CID=${currentReport.cid}`,
          );
          break reportFetchLoop;
        }

        currentReport = previousReport;
        currentLeaves = previousLeaves;
      }

      skipPagination += batchSize;
    }

    this.logger.log(
      `[calculateVaultMetrics] Reports statistic calculation complete, pairsCalculated=${pairsCalculated}!`,
    );
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'calculateVaultMetrics', type: 'timestamp' })
      .set(Date.now() / 1000);
  }

  public subscribeToEvents() {
    this.logger.log('[subscribeToEvents, event:VaultsReportDataUpdated] Subscribing to VaultsReportDataUpdated event');

    this.lazyOracleContractService.contract.on(
      'VaultsReportDataUpdated',
      async (timestamp: bigint, refSlot: bigint, root: string, cid: string, event) => {
        this.logger.log(
          `[subscribeToEvents, event:VaultsReportDataUpdated] Event received: timestamp=${timestamp}, refSlot=${refSlot}, root=${root}, cid=${cid}, block=${event.blockNumber}`,
        );

        let currentReportData;
        let currentReport;
        try {
          currentReportData = await this.lsvService.fetchIPFS(cid);
          this.logger.log(`[subscribeToEvents, event:VaultsReportDataUpdated] Fetched report for CID: ${cid}`);

          currentReport = await this.reportDbService.saveReport(cid, currentReportData);
          this.logger.log(`[subscribeToEvents, event:VaultsReportDataUpdated] Saved the report for CID: ${cid}`);

          await this.reportDbService.saveLeaves(currentReport, currentReportData);
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

        try {
          const prevCid = currentReportData.prevTreeCID.trim();
          const previousReport = await this.reportDbService.findByCid(prevCid);

          const [currentLeaves, previousLeaves] = await Promise.all([
            this.reportDbService.getLeavesByReport(currentReport),
            this.reportDbService.getLeavesByReport(previousReport),
          ]);

          await this.calculateForVaultsBasedPrevReport(currentReport, previousReport, currentLeaves, previousLeaves);
        } catch (error) {
          this.logger.error(
            `[subscribeToEvents, event:VaultsReportDataUpdated] Failed to findByCid/getLeavesByReport/calculateForVaultsBasedPrevReport report with cid=${cid}`,
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
    return (await this.lidoContractService.contract.totalSupply({ blockTag: blockNumber })).toBigInt();
  }

  private async totalShares(blockNumber: number): Promise<bigint> {
    return (await this.lidoContractService.contract.getTotalShares({ blockTag: blockNumber })).toBigInt();
  }

  private calculateShareRate = async (blockNumber: number): Promise<bigint> => {
    return this.shareRateCache.fetch(blockNumber);
  };
}

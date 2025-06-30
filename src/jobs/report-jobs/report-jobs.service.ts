import fetch from 'node-fetch';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { Lido, LIDO_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

import { reportMetrics } from '@lidofinance/lsv-cli/dist/utils/statistic/report-statistic';
import { type VaultReport as VaultReportCliType } from '@lidofinance/lsv-cli/dist/utils/report';
import { calculateRebaseReward } from '@lidofinance/lsv-cli/dist/utils/rebase-rewards';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ReportEntity, ReportLeafEntity, ReportService } from 'report';
import { VaultsService } from 'vault';

@Injectable()
export class ReportJobsService {
  // TODO: to config
  private readonly BATCH_SIZE = 100;

  private nodeOperatorFeeRateByVault = new Map<string, bigint>();

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    @Inject(LIDO_CONTRACT_TOKEN) private readonly lidoContract: Lido,
    private readonly lazyOracleContractService: LazyOracleContractService,
    private readonly reportService: ReportService,
    private readonly vaultsService: VaultsService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportJobsService initialization started');

    // TODO: add event here (ReportCreated)

    this.logger.log('VaultJobsService initialization finished');
  }

  async fetchReportFromIPFS(cid: string): Promise<any> {
    const url = `${this.configService.get('IPFS_GATEWAY')}/${cid}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch IPFS report: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  async fetchAllReports(): Promise<void> {
    let cid: string | null = (await this.lazyOracleContractService.getLatestReportData()).reportCid;

    while (cid) {
      try {
        const reportData = await this.fetchReportFromIPFS(cid);
        console.log(`Fetched report for CID: ${cid}`);

        // TODO: remove for new hoodie testnets
        // skip all old reports, e.g. https://ipfs.io/ipfs/QmQfBBNh66bhJFd4EP3BvY1CURGsD6Gav33jvTozVHsyQo
        const values = reportData?.values;
        const extraValues = reportData?.extraValues;
        if (!values?.length || !extraValues || Object.keys(extraValues).length === 0) {
          console.log(`Skip the report for CID: ${cid}`);
          return;
        }

        const report = await this.reportService.saveReport(cid, reportData);
        console.log(`Saved the report for CID: ${cid}`);

        await this.reportService.saveLeaves(report, reportData || []);
        console.log(`Saved leaves for CID: ${cid}`);

        cid = reportData.prevTreeCID && reportData.prevTreeCID.trim() !== '' ? reportData.prevTreeCID : null;
      } catch (error) {
        console.error(`Failed to fetch/save report with CID: ${cid}`, error);
        return;
      }
    }

    console.log(`Report fetching complete!`);
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

      const currentVaultReport = ReportJobsService.toVaultReportCliTyping(currentReport, currLeaf);
      const previousVaultReport = ReportJobsService.toVaultReportCliTyping(previousReport, prevLeaf);

      // nodeOperatorFeeRate cache
      let nodeOperatorFeeRate: bigint;
      if (this.nodeOperatorFeeRateByVault.has(vaultAddress)) {
        nodeOperatorFeeRate = this.nodeOperatorFeeRateByVault.get(vaultAddress);
      } else {
        const vaultState = await this.vaultsService.getStateByVaultAddress(vaultAddress);
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

      await this.vaultsService.addOrUpdateReportStats({
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

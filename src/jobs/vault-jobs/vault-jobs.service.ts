import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';
import { calculateHealth } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { VaultsService } from 'vault';
import { VaultsStateHourlyService } from 'vaults-state-hourly';

import { VaultMemberJobsService } from '../vault-member-jobs';
import { ReportJobsService } from '../report-jobs';

@Injectable()
export class VaultJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly vaultsService: VaultsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
    private readonly executionProviderService: ExecutionProviderService,
    private readonly vaultMemberJobsService: VaultMemberJobsService,
    private readonly reportJobsService: ReportJobsService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultJobsService initialization started');

    // subscribes to events
    this.subscribeToEvents();

    // one-time execution on startup
    // await this.fetchAllVaultsAndStateHourly();
    // await this.vaultMemberJobsService.fetchAllVaultsRoleMembers();
    await this.reportJobsService.fetchAllReports();

    const job = new CronJob(
      this.configService.jobs['vaultsHourlyCron'],
      async () => {
        // await this.fetchAllVaultsAndStateHourly();
        // await this.vaultMemberJobsService.fetchAllVaultsRoleMembers();
        await this.reportJobsService.fetchAllReports();
      },
      null,
      false,
      this.configService.jobs['vaultsHourlyCronTZ'],
    );

    this.schedulerRegistry.addCronJob('vaults-hourly', job);
    job.start();
    this.logger.log('VaultJobsService initialization finished');
  }

  public async fetchAllVaultsAndStateHourly(): Promise<void> {
    this.logger.log('[fetchAllVaultsAndStateHourly] Started');

    const batchSize = this.configService.jobs['vaultsHourlyBatchSize'];

    let blockNumber: number;
    try {
      blockNumber = await this.executionProviderService.getBlockNumber();
    } catch (err) {
      this.logger.error(`[fetchAllVaultsAndStateHourly] Failed to fetch blockNumber for batch: ${err}`);
      return;
    }

    // 1. Get vaultsCount with first batch (0, batchSize - 1) + leftover
    let initialBatch = [];
    let leftoverVaults = 0;
    try {
      const result = await this.vaultViewerContractService.getVaultsConnectedBound(0, batchSize - 1, {
        blockTag: blockNumber,
      });
      initialBatch = result.addresses;
      leftoverVaults = result.leftoverVaults;
    } catch (err: any) {
      this.logger.error(
        `[fetchAllVaultsAndStateHourly] Failed to fetch vaultsConnectedBound (0 - ${
          batchSize - 1
        }) at block ${blockNumber}: ${err}`,
      );
      return;
    }

    const vaultsCount = initialBatch.length + leftoverVaults;
    this.logger.log(`[fetchAllVaultsAndStateHourly] Total vaults: ${vaultsCount}`);

    // 2. Starting to fetch vaults data
    for (let from = 0; from < vaultsCount; from += batchSize) {
      const to = Math.min(from + batchSize, vaultsCount);
      this.logger.log(`[fetchAllVaultsAndStateHourly] Fetching vaults batch: ${from} to ${to}`);

      let vaultsDataBatch;
      try {
        vaultsDataBatch = (
          await this.vaultViewerContractService.getVaultsDataBound(from, to, { blockTag: blockNumber })
        ).vaultsDataBatch;
      } catch (err) {
        this.logger.error(
          `[fetchAllVaultsAndStateHourly] Failed to fetch vaultsDataBatch (${from} - ${to}) at block ${blockNumber}: ${err}`,
        );
        continue;
      }

      for (const item of vaultsDataBatch) {
        let vault;
        try {
          vault = await this.vaultsService.getOrCreateVaultByAddress(item.vault);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndStateHourly] Failed to get or create vault: ${item.vault} — ${err} at block ${blockNumber}`,
          );
          continue;
        }

        try {
          const healthFactor = calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.liabilityStETH,
            forceRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
          });

          await this.vaultsStateHourlyService.addOrUpdate({
            vault,
            totalValue: item.totalValue.toString(),
            liabilityShares: item.liabilityShares.toString(),
            liabilityStETH: item.liabilityStETH.toString(),
            healthFactor: healthFactor.healthRatio,
            shareLimit: item.shareLimit.toString(),
            reserveRatioBP: item.reserveRatioBP,
            forcedRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
            infraFeeBP: item.infraFeeBP,
            liquidityFeeBP: item.liquidityFeeBP,
            reservationFeeBP: item.reservationFeeBP,
            nodeOperatorFeeRate: item.nodeOperatorFeeRate.toString(),
            updatedAt: new Date(),
            blockNumber,
          });
          this.logger.log(`[fetchAllVaultsAndStateHourly] Saved 'vaultsStateHourly' data to DB ${item.vault}`);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndStateHourly] Failed to save 'vaultsStateHourly' data to DB OR calculateHealth of vault ${item.vault}: ${err}`,
          );
          // continue
        }
      }
    }

    this.logger.log('[fetchAllVaultsAndStateHourly] finished');
  }

  private subscribeToEvents() {
    this.logger.log('[subscribeToEvents] Subscribing to VaultConnected event');

    this.vaultHubContractService.contract.on(
      'VaultConnected',
      async (
        vault: string,
        shareLimit: bigint,
        reserveRatioBP: bigint,
        forcedRebalanceThresholdBP: bigint,
        infraFeeBP: bigint,
        liquidityFeeBP: bigint,
        reservationFeeBP: bigint,
        event,
      ) => {
        this.logger.log(
          `[subscribeToEvents, event:VaultConnected] Event received for vault ${vault} at block ${event.blockNumber}`,
        );

        try {
          const blockNumber = event.blockNumber;
          const item = await this.vaultViewerContractService.getVaultData(vault, {
            blockTag: blockNumber,
          });

          const vaultDbEntity = await this.vaultsService.getOrCreateVaultByAddress(item.vault);

          const healthFactor = calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.liabilityStETH,
            forceRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
          });

          await this.vaultsStateHourlyService.addOrUpdate({
            vault: vaultDbEntity,
            totalValue: item.totalValue.toString(),
            liabilityShares: item.liabilityShares.toString(),
            liabilityStETH: item.liabilityStETH.toString(),
            healthFactor: healthFactor.healthRatio,
            shareLimit: item.shareLimit.toString(),
            reserveRatioBP: item.reserveRatioBP,
            forcedRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
            infraFeeBP: item.infraFeeBP,
            liquidityFeeBP: item.liquidityFeeBP,
            reservationFeeBP: item.reservationFeeBP,
            nodeOperatorFeeRate: item.nodeOperatorFeeRate.toString(),
            updatedAt: new Date(),
            blockNumber,
          });
          this.logger.log(
            `[fetchAllVaultsAndStateHourly] Saved 'vaultsStateHourly' data to DB for vault ${item.vault}`,
          );

          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] State added/updated for vault ${vault} at block ${blockNumber}`,
          );
        } catch (err) {
          this.logger.warn(`[subscribeToEvents] Failed to process VaultConnected for ${vault}: ${err}`);
        }
      },
    );
  }
}

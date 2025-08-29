import { Inject, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService, type RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { TrackJob } from 'common/job/track-job.decorator';
import { VaultDbService } from 'db/vault-db';
import { ROLE_BYTES32 } from 'vault/vault.constants';
import { LsvService } from 'lsv';

@Injectable()
export class VaultService {
  private fetchAllVaultsAndCalculateStatesInFlight?: Promise<void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultDbService: VaultDbService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly lsvService: LsvService,
    private readonly prometheusService: PrometheusService,
  ) {}

  /**
   * ⚠️ Important: passing `blockNumber` here does not guarantee it will be used.
   * This method can be called from multiple places (VaultJobsService, ReportJobsService)
   * and is guarded by a single-flight mechanism: if a run is already in progress,
   * subsequent calls will join the same Promise and ignore the new `blockNumber`.
   */
  public async fetchAllVaultsAndCalculateStates(blockNumber: number): Promise<void> {
    // prevent concurrent runs: return the same Promise if already running
    if (this.fetchAllVaultsAndCalculateStatesInFlight) {
      this.logger.warn('[fetchAllVaultsAndCalculateStates] Already running — skip (joining current run)');
      return this.fetchAllVaultsAndCalculateStatesInFlight.catch(() => undefined);
    }

    this.fetchAllVaultsAndCalculateStatesInFlight = this._fetchAllVaultsAndCalculateStates(blockNumber)
      .catch((err) => {
        this.logger.error('[fetchAllVaultsAndCalculateStates] Run failed', err);
        throw err;
      })
      .finally(() => {
        this.fetchAllVaultsAndCalculateStatesInFlight = undefined;
      });

    return this.fetchAllVaultsAndCalculateStatesInFlight;
  }

  @TrackJob('fetchAllVaultsAndCalculateStates')
  private async _fetchAllVaultsAndCalculateStates(blockNumber: number): Promise<void> {
    this.logger.log('[fetchAllVaultsAndCalculateStates] Started');

    const batchSize = this.configService.jobs['vaultsBatchSize'];

    // 1. Get vaultsCount, vaultsConnectedBound (0, 0) - works and return:
    // - vaults empty array
    // - vaults count
    let initialBatch = [];
    let leftoverVaults = 0;
    try {
      const result = await this.vaultViewerContractService.getVaultsConnectedBound(0, 0, {
        blockTag: blockNumber,
      });
      initialBatch = result.addresses;
      leftoverVaults = result.leftoverVaults;
    } catch (err: any) {
      this.logger.error(
        `[fetchAllVaultsAndCalculateStates] Failed to fetch vaultsConnectedBound (0, 0) at block ${blockNumber}: ${err}`,
      );
      return;
    }

    const vaultsCount = initialBatch.length + leftoverVaults;
    this.logger.log(`[fetchAllVaultsAndCalculateStates] Total vaults: ${vaultsCount}`);

    // 2. Starting to fetch vaults data
    for (let from = 0; from < vaultsCount; from += batchSize) {
      const to = Math.min(from + batchSize, vaultsCount);
      this.logger.log(`[fetchAllVaultsAndCalculateStates] Fetching vaults batch: ${from} to ${to}`);

      let vaultsDataBatch;
      try {
        vaultsDataBatch = (
          await this.vaultViewerContractService.getVaultsDataBound(from, to, { blockTag: blockNumber })
        ).vaultsDataBatch;
      } catch (err) {
        this.logger.error(
          `[fetchAllVaultsAndCalculateStates] Failed to fetch vaultsDataBatch (${from} - ${to}) at block ${blockNumber}: ${err}`,
        );
        continue;
      }

      for (const item of vaultsDataBatch) {
        let vault;
        try {
          vault = await this.vaultDbService.getOrCreateVaultByAddress(item.vault);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to get or create vault: ${item.vault} — ${err} at block ${blockNumber}`,
          );
          continue;
        }

        try {
          const healthFactor = await this.lsvService.calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.liabilityStETH,
            forceRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
          });

          await this.vaultDbService.addOrUpdateState({
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
            isReportFresh: item.isReportFresh,
            isQuarantineActive: item.isQuarantineActive,
            quarantinePendingTotalValueIncrease: item.quarantinePendingTotalValueIncrease.toString(),
            quarantineStartTimestamp: item.quarantineStartTimestamp,
            quarantineEndTimestamp: item.quarantineEndTimestamp,
            updatedAt: new Date(),
            blockNumber,
          });
          this.logger.log(`[fetchAllVaultsAndCalculateStates] Saved 'vaultsState' data to DB ${item.vault}`);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to save 'vaultsState' data to DB OR calculateHealth of vault ${item.vault}: ${err}`,
          );
          // continue
        }
      }
    }

    this.logger.log('[fetchAllVaultsAndCalculateStates] finished');
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'fetchAllVaultsAndCalculateStates', type: 'timestamp' })
      .set(Date.now() / 1000);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'fetchAllVaultsAndCalculateStates', type: 'blockNumber' })
      .set(blockNumber);
  }

  @TrackJob('fetchAllVaultsRoleMembers')
  public async fetchAllVaultsRoleMembers(blockNumber: number): Promise<void> {
    this.logger.log('[fetchAllVaultsRoleMembers] Started');

    const totalVaults = await this.vaultDbService.getVaultsCount();
    this.logger.log(`[fetchAllVaultsRoleMembers] Total vaults: ${totalVaults}`);

    const batchSize = this.configService.jobs['vaultMembersBatchSize'];

    for (let offset = 0; offset < totalVaults; offset += batchSize) {
      const vaultEntities = await this.vaultDbService.getVaults(batchSize, offset);
      if (vaultEntities.length === 0) break;

      this.logger.log(`[fetchAllVaultsRoleMembers] Fetching vaults ${offset}..${offset + vaultEntities.length - 1}`);
      const vaultAddresses = vaultEntities.map((vault) => vault.address);

      let batchResults: Array<{ vault: string; roleMembersMap: RoleMembers }>;
      try {
        batchResults = await this.vaultViewerContractService.getRoleMembersBatch(vaultAddresses, ROLE_BYTES32, {
          blockTag: blockNumber,
        });
      } catch (err) {
        this.logger.error(`[fetchAllVaultsRoleMembers] Error fetching batch role members: ${err.message}`);
        continue;
      }

      this.logger.log(`[fetchAllVaultsRoleMembers] Saving vaults ${offset}..${offset + vaultEntities.length - 1}`);
      for (const { vault, roleMembersMap } of batchResults) {
        try {
          await this.vaultDbService.setMembersForVault(vault, roleMembersMap);
          this.logger.log(`[fetchAllVaultsRoleMembers] Saved 'membersForVault' data to DB for vault ${vault}`);
        } catch (err) {
          this.logger.error(`[fetchAllVaultsRoleMembers] Error saving role members for vault ${vault}: ${err.message}`);
        }
      }
    }

    this.logger.log('[fetchAllVaultsRoleMembers] Finished');
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'fetchAllVaultsRoleMembers', type: 'timestamp' })
      .set(Date.now() / 1000);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'fetchAllVaultsRoleMembers', type: 'blockNumber' })
      .set(blockNumber);
  }

  public subscribeToEvents() {
    this.logger.log('[subscribeToEvents, event:VaultConnected] Subscribing to VaultConnected event');

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

          const vaultDbEntity = await this.vaultDbService.getOrCreateVaultByAddress(item.vault);

          const healthFactor = await this.lsvService.calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.liabilityStETH,
            forceRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
          });

          await this.vaultDbService.addOrUpdateState({
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
            `[subscribeToEvents, event:VaultConnected] Saved 'vaultsState' data to DB for vault ${item.vault}`,
          );

          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] State added/updated for vault ${vault} at block ${blockNumber}`,
          );
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultConnected', result: 'success' })
            .inc();
        } catch (err) {
          this.logger.error(
            `[subscribeToEvents, event:VaultConnected] Failed to process VaultConnected for ${vault}: ${err}`,
          );
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultConnected', result: 'error' })
            .inc();
        }
      },
    );
  }
}

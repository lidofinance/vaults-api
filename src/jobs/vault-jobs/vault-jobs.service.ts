import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';
import { calculateHealth } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService, type RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { VaultsService } from 'vault';
import { ROLE_BYTES32 } from 'vault/vault.constants';

@Injectable()
export class VaultJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly vaultsService: VaultsService,
    private readonly executionProviderService: ExecutionProviderService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultJobsService initialization started');

    // subscribes to events
    this.subscribeToEvents();

    this.logger.log('VaultJobsService initialization finished');
  }

  public async fetchAllVaultsAndCalculateStates(): Promise<void> {
    this.logger.log('[fetchAllVaultsAndCalculateStates] Started');

    const batchSize = this.configService.jobs['vaultsHourlyBatchSize'];

    let blockNumber: number;
    try {
      blockNumber = await this.executionProviderService.getBlockNumber();
    } catch (err) {
      this.logger.error(`[fetchAllVaultsAndCalculateStates] Failed to fetch blockNumber for batch: ${err}`);
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
        `[fetchAllVaultsAndCalculateStates] Failed to fetch vaultsConnectedBound (0 - ${
          batchSize - 1
        }) at block ${blockNumber}: ${err}`,
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
          vault = await this.vaultsService.getOrCreateVaultByAddress(item.vault);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to get or create vault: ${item.vault} — ${err} at block ${blockNumber}`,
          );
          continue;
        }

        try {
          const healthFactor = calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.liabilityStETH,
            forceRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
          });

          await this.vaultsService.addOrUpdateState({
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
          this.logger.log(`[fetchAllVaultsAndCalculateStates] Saved 'vaultsStateHourly' data to DB ${item.vault}`);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to save 'vaultsStateHourly' data to DB OR calculateHealth of vault ${item.vault}: ${err}`,
          );
          // continue
        }
      }
    }

    this.logger.log('[fetchAllVaultsAndCalculateStates] finished');
  }

  public async fetchAllVaultsRoleMembers(): Promise<void> {
    this.logger.log('[fetchAllVaultsRoleMembers] Started');

    const totalVaults = await this.vaultsService.getVaultsCount();
    this.logger.log(`[fetchAllVaultsRoleMembers] Total vaults: ${totalVaults}`);

    const batchSize = this.configService.jobs['vaultMembersBatchSize'];

    let blockNumber: number;
    try {
      blockNumber = await this.executionProviderService.getBlockNumber();
    } catch (err) {
      this.logger.error(`[fetchAllVaultsAndStateHourly] Failed to fetch blockNumber for batch: ${err}`);
      return;
    }

    for (let offset = 0; offset < totalVaults; offset += batchSize) {
      const vaultEntities = await this.vaultsService.getVaults(batchSize, offset);
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
          await this.vaultsService.setMembersForVault(vault, roleMembersMap);
          this.logger.log(`[fetchAllVaultsRoleMembers] Saved 'membersForVault' data to DB for vault ${vault}`);
        } catch (err) {
          this.logger.error(`[fetchAllVaultsRoleMembers] Error saving role members for vault ${vault}: ${err.message}`);
        }
      }
    }

    this.logger.log('[fetchAllVaultsRoleMembers] Finished');
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

          await this.vaultsService.addOrUpdateState({
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
            `[fetchAllVaultsAndCalculateStates] Saved 'vaultsStateHourly' data to DB for vault ${item.vault}`,
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

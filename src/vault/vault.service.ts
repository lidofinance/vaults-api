import { Inject, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService, type RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { SingleFlight } from 'common/job/single-flight.decorator';
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

  @TrackJob('fetchAllVaultsAndCalculateStates')
  @SingleFlight({ key: 'fetchAllVaultsAndCalculateStates', log: true })
  public async fetchAllVaultsAndCalculateStates(blockNumber: number): Promise<void> {
    this.logger.log(`[fetchAllVaultsAndCalculateStates] Started at blockNumber=${blockNumber}`);
    const minimalVaultsFetchingCount = this.configService.get('MINIMAL_VAULTS_FETCHING_MODE_COUNT');
    const batchSize = this.configService.jobs['vaultsBatchSize'];

    // 1. Get vaultsCount
    let vaultsCount = 0;
    try {
      vaultsCount = await this.vaultViewerContractService.vaultsCount({
        blockTag: blockNumber,
      });
    } catch (err: any) {
      this.logger.error(
        `[fetchAllVaultsAndCalculateStates] Failed to fetch vaultsCount() at block ${blockNumber}: ${err}`,
      );
      return;
    }
    this.logger.log(`[fetchAllVaultsAndCalculateStates] Total vaults: ${vaultsCount}`);

    // 2. Starting to fetch vaults data
    let vaultsLimit = vaultsCount;
    if (minimalVaultsFetchingCount > 0 && vaultsCount > 0) {
      vaultsLimit = Math.min(minimalVaultsFetchingCount, vaultsCount);
      this.logger.log(
        `[fetchAllVaultsAndCalculateStates] Running in minimal vaults fetching mode, vaultsLimit=${vaultsLimit}`,
      );
    }
    for (let offset = 0; offset < vaultsLimit; offset += batchSize) {
      const limit = Math.min(batchSize, vaultsLimit - offset);
      this.logger.log(`[fetchAllVaultsAndCalculateStates] Fetching vaults batch: offset=${offset}, limit=${limit}`);

      let vaultsDataBatch;
      try {
        vaultsDataBatch = await this.vaultViewerContractService.getVaultsDataBatch(offset, limit, {
          blockTag: blockNumber,
        });
      } catch (err) {
        this.logger.error(
          `[fetchAllVaultsAndCalculateStates] Failed to fetch vaultsDataBatch (${offset}, ${limit}) at block ${blockNumber}: ${err}`,
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
            forcedRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
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
  @SingleFlight({ key: 'fetchAllVaultsRoleMembers', log: true })
  public async fetchAllVaultsRoleMembers(blockNumber: number): Promise<void> {
    this.logger.log(`[fetchAllVaultsRoleMembers] Started at blockNumber=${blockNumber}`);
    const minimalVaultsFetchingCount = this.configService.get('MINIMAL_VAULTS_FETCHING_MODE_COUNT');
    const batchSize = this.configService.jobs['vaultMembersBatchSize'];

    const totalVaults = await this.vaultDbService.getVaultsCount();
    this.logger.log(`[fetchAllVaultsRoleMembers] Total vaults: ${totalVaults}`);

    let vaultsLimit = totalVaults;
    if (minimalVaultsFetchingCount > 0 && totalVaults > 0) {
      vaultsLimit = Math.min(minimalVaultsFetchingCount, totalVaults);
      this.logger.log(
        `[fetchAllVaultsRoleMembers] Running in minimal vaults fetching mode, vaultsLimit=${vaultsLimit}`,
      );
    }
    for (let offset = 0; offset < vaultsLimit; offset += batchSize) {
      const limit = Math.min(batchSize, vaultsLimit - offset);
      const vaultEntities = await this.vaultDbService.getVaults(limit, offset);
      if (vaultEntities.length === 0) break;

      this.logger.log(
        `[fetchAllVaultsRoleMembers] Loaded vaults range(${offset}..${offset + vaultEntities.length - 1})`,
      );
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

      this.logger.log(
        `[fetchAllVaultsRoleMembers] Saving vaults range(${offset}..${offset + vaultEntities.length - 1})`,
      );
      for (const { vault, roleMembersMap } of batchResults) {
        try {
          await this.vaultDbService.setMembersForVault(vault, roleMembersMap);
          this.logger.log(`[fetchAllVaultsRoleMembers] Saved 'membersForVault' data to DB for vault ${vault}`);
          // zero response is
          // roleMembersMap: {
          //   'vaults.StakingVault.owner': [ '0x0000000000000000000000000000000000000000' ],
          //   'vaults.StakingVault.nodeOperator': [ '0x0000000000000000000000000000000000000000' ]
          // }
          // Object.keys(roleMembersMap).length = 2
          this.logger.log(
            `[fetchAllVaultsRoleMembers] Object.keys(roleMembersMap).length ${Object.keys(roleMembersMap).length}`,
          );
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
            forcedRebalanceThresholdBP: item.forcedRebalanceThresholdBP,
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
            isReportFresh: item.isReportFresh,
            isQuarantineActive: item.isQuarantineActive,
            quarantinePendingTotalValueIncrease: item.quarantinePendingTotalValueIncrease.toString(),
            quarantineStartTimestamp: item.quarantineStartTimestamp,
            quarantineEndTimestamp: item.quarantineEndTimestamp,
            updatedAt: new Date(),
            blockNumber,
          });
          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] Saved 'vaultsState' data to DB for vault ${item.vault}`,
          );

          const roleMembersMap = await this.vaultViewerContractService.getRoleMembersWithRetry(vault, ROLE_BYTES32, {
            blockTag: blockNumber,
          });

          await this.vaultDbService.setMembersForVault(vault, roleMembersMap);
          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] Saved 'membersForVault' data to DB for vault ${vault}`,
          );
          // zero response is
          // roleMembersMap: {
          //   'vaults.StakingVault.owner': [ '0x0000000000000000000000000000000000000000' ],
          //   'vaults.StakingVault.nodeOperator': [ '0x0000000000000000000000000000000000000000' ]
          // }
          // Object.keys(roleMembersMap).length = 2
          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] Object.keys(roleMembersMap).length ${
              Object.keys(roleMembersMap).length
            }`,
          );

          this.logger.log(
            `[subscribeToEvents, event:VaultConnected] State and roles added/updated for vault ${vault} at block ${blockNumber}`,
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

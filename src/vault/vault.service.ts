import chunk from 'lodash.chunk';
import { Inject, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from 'common/config';
import { PrometheusService } from 'common/prometheus';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService, type RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { StakingVaultContractFactory } from 'common/contracts/modules/staking-vault-contract';
import { DashboardContractFactory } from 'common/contracts/modules/dashboard-contract';
import { SingleFlight } from 'common/job/single-flight.decorator';
import { TrackJob } from 'common/job/track-job.decorator';
import { VaultDbService, VaultEntity } from 'db/vault-db';
import {
  DASHBOARD_OWNER_ROLE,
  DEFAULT_ADMIN_ROLE,
  ROLE_BYTES32,
  STAKING_VAULT_OWNER_ROLE,
} from 'vault/vault.constants';
import { LsvService } from 'lsv';
import { constants } from 'ethers';

@Injectable()
export class VaultService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultDbService: VaultDbService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly stakingVaultContractFactory: StakingVaultContractFactory,
    private readonly dashboardContractFactory: DashboardContractFactory,
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

    const onChainVaultAddresses = new Set<string>();

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
        const vaultAddress = item.vault;
        onChainVaultAddresses.add(vaultAddress.toLowerCase());

        let vault;
        try {
          vault = await this.vaultDbService.getOrCreateVaultByAddress(vaultAddress, { isDisconnected: false });
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to get or create vault: ${vaultAddress} — ${err} at block ${blockNumber}`,
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
            accruedFee: item.accruedFee.toString(),
            isReportFresh: item.isReportFresh,
            isQuarantineActive: item.isQuarantineActive,
            quarantinePendingTotalValueIncrease: item.quarantinePendingTotalValueIncrease.toString(),
            quarantineStartTimestamp: item.quarantineStartTimestamp,
            quarantineEndTimestamp: item.quarantineEndTimestamp,
            updatedAt: new Date(),
            blockNumber,
          });
          this.logger.log(`[fetchAllVaultsAndCalculateStates] Saved 'vaultsState' data to DB ${vaultAddress}`);

          // If a vault is on-chain, it should be considered connected
          await this.vaultDbService.connectVault(vaultAddress, blockNumber, item.connectionOwner);
          this.logger.log(`[fetchAllVaultsAndCalculateStates] Set vault ${vaultAddress} as connected`);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsAndCalculateStates] Failed to save 'vaultsState' data to DB OR calculateHealth of vault ${vaultAddress} — ${err} at block ${blockNumber}`,
          );
          // continue
        }
      }
    }

    // 3. Find disconnected vaults and mark it
    // We do this only if we fetched a full list, and not a `minimalVaultsFetchingCount`
    if (vaultsLimit === vaultsCount) {
      try {
        const dbVaultAddresses = await this.vaultDbService.getAllConnectedVaultAddresses();
        for (const dbAddress of dbVaultAddresses) {
          if (!onChainVaultAddresses.has(dbAddress.toLowerCase())) {
            const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(dbAddress, blockNumber);
            await this.vaultDbService.disconnectVault(dbAddress, blockNumber, effectiveOwner);
            this.logger.log(
              `[fetchAllVaultsAndCalculateStates] Set vault ${dbAddress} as disconnected (not returned by contract at block ${blockNumber})`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `[fetchAllVaultsAndCalculateStates] Failed to detect and set disconnected vaults at block ${blockNumber} — ${err} at block ${blockNumber}`,
        );
      }
    } else {
      this.logger.log(
        `[fetchAllVaultsAndCalculateStates] Skipping disconnected vaults detection because running in minimalVaultsFetchingCount — at block ${blockNumber}`,
      );
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

    // Only connected vaults: `VaultViewer` resolves roles through the `VaultHub` connection, and for
    // a disconnected vault that record is gone, so it answers with zero addresses. Refreshing from
    // that response would wipe the last known good roles and cut the owner off from their own vault.
    // Keeping them frozen is safe — `membersOwnerAddress` marks them stale as soon as the vault
    // changes hands.
    const roleMembersFilter = { isDisconnected: false };

    const totalVaults = await this.vaultDbService.getVaultsCount(roleMembersFilter);
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
      const vaultEntities = await this.vaultDbService.getVaults(limit, offset, roleMembersFilter);
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

  public async subscribeToEvents(): Promise<void> {
    this.logger.log(
      '[subscribeToEvents] Subscribing to {VaultConnected, VaultOwnershipTransferred, VaultDisconnectCompleted} event',
    );

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

          const vaultDbEntity = await this.vaultDbService.getOrCreateVaultByAddress(item.vault, {
            isDisconnected: false,
          });

          await this.vaultDbService.connectVault(vault, blockNumber, item.connectionOwner);

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

    this.vaultHubContractService.contract.on(
      'VaultOwnershipTransferred',
      async (vault: string, newOwner: string, oldOwner: string, event) => {
        this.logger.log(
          `[subscribeToEvents, event:VaultOwnershipTransferred] Event received for vault ${vault} ` +
            `at block ${event.blockNumber}`,
        );

        try {
          await this.vaultDbService.updateVaultOwnership(vault, newOwner, event.blockNumber);
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultOwnershipTransferred', result: 'success' })
            .inc();
        } catch (err) {
          this.logger.error(
            `[subscribeToEvents, event:VaultOwnershipTransferred] Failed to process event for ${vault}: ${err}`,
          );
          this.prometheusService.contractEventHandledCounter
            .labels({ eventName: 'VaultOwnershipTransferred', result: 'error' })
            .inc();
        }
      },
    );

    this.vaultHubContractService.contract.on('VaultDisconnectCompleted', async (vault: string, event) => {
      this.logger.log(
        `[subscribeToEvents, event:VaultDisconnectCompleted] Event received for vault ${vault} at block ${event.blockNumber}`,
      );

      try {
        const blockNumber = event.blockNumber;
        const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(vault, blockNumber);
        await this.vaultDbService.disconnectVault(vault, blockNumber, effectiveOwner);

        this.logger.log(`[subscribeToEvents, event:VaultDisconnectCompleted] Set vault ${vault} as disconnected in DB`);

        this.prometheusService.contractEventHandledCounter
          .labels({ eventName: 'VaultDisconnectCompleted', result: 'success' })
          .inc();
      } catch (err) {
        this.logger.error(
          `[subscribeToEvents, event:VaultDisconnectCompleted] Failed to process VaultDisconnectCompleted for ${vault}: ${err}`,
        );
        this.prometheusService.contractEventHandledCounter
          .labels({ eventName: 'VaultDisconnectCompleted', result: 'error' })
          .inc();
      }
    });
  }

  /**
   * Once a vault leaves the VaultHub, its owner changes without any VaultHub event: the Dashboard
   * accepts the ownership handover and may pass it on to an arbitrary address. Those transfers are
   * picked up by polling `StakingVault` ownership instead of per-vault log filters — the execution
   * provider is HTTP-based, so every filter would cost its own `eth_getLogs` on every poll.
   */
  @TrackJob('reconcileDisconnectedVaultOwners')
  @SingleFlight({ key: 'reconcileDisconnectedVaultOwners', log: true })
  public async reconcileDisconnectedVaultOwners(blockNumber: number): Promise<void> {
    this.logger.log(`[reconcileDisconnectedVaultOwners] Started at blockNumber=${blockNumber}`);

    const vaults = await this.vaultDbService.getAllDisconnectedVaultAddresses();
    const batchSize = this.configService.jobs['vaultsBatchSize'];

    for (const batch of chunk(vaults, batchSize)) {
      await Promise.all(
        batch.map(async (vault) => {
          try {
            const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(vault, blockNumber);
            await this.vaultDbService.updateVaultOwnership(vault, effectiveOwner, blockNumber, {
              onlyDisconnected: true,
            });
          } catch (err) {
            this.logger.error(
              `[reconcileDisconnectedVaultOwners] Failed to synchronize owner for vault ${vault} ` +
                `at block ${blockNumber}: ${err}`,
            );
          }
        }),
      );
    }

    this.logger.log(`[reconcileDisconnectedVaultOwners] Finished, disconnected vaults: ${vaults.length}`);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'reconcileDisconnectedVaultOwners', type: 'timestamp' })
      .set(Date.now() / 1000);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'reconcileDisconnectedVaultOwners', type: 'blockNumber' })
      .set(blockNumber);
  }

  /**
   * Fills the ownership columns for vaults stored before those columns existed.
   * Idempotent: it only looks at rows with an empty `effectiveOwnerAddress`, so re-running it on
   * every deploy is a single cheap query once the backfill is done.
   */
  @TrackJob('backfillVaultOwnership')
  @SingleFlight({ key: 'backfillVaultOwnership', log: true })
  public async backfillVaultOwnership(blockNumber: number): Promise<void> {
    const membersOwnerFilled = await this.vaultDbService.backfillMembersOwnerFromRoleMembers();
    if (membersOwnerFilled > 0) {
      this.logger.log(`[backfillVaultOwnership] Recovered membersOwnerAddress for ${membersOwnerFilled} vault(s)`);
    }

    await this.resolveMissingVaultOwners(blockNumber);
    await this.repairDisconnectedVaultRoleMembers(blockNumber);
  }

  private async resolveMissingVaultOwners(blockNumber: number): Promise<void> {
    const batchSize = this.configService.jobs['vaultsBatchSize'];
    let afterId = 0;
    let processed = 0;
    let failed = 0;

    for (;;) {
      const vaults = await this.vaultDbService.getVaultsWithoutOwnership(batchSize, afterId);
      if (vaults.length === 0) break;

      // Advance the cursor before processing: a vault that fails must not block the whole scan.
      afterId = vaults[vaults.length - 1].id;

      await Promise.all(
        vaults.map(async (vault) => {
          try {
            await this.backfillSingleVaultOwnership(vault, blockNumber);
            processed++;
          } catch (err) {
            failed++;
            this.logger.error(
              `[backfillVaultOwnership] Failed to resolve ownership for vault ${vault.address} ` +
                `at block ${blockNumber}: ${err}`,
            );
          }
        }),
      );
    }

    if (processed === 0 && failed === 0) {
      this.logger.log('[backfillVaultOwnership] Every vault already has its ownership resolved');
      return;
    }

    this.logger.log(
      `[backfillVaultOwnership] Resolved owners at blockNumber=${blockNumber}: processed=${processed}, failed=${failed}`,
    );
  }

  /**
   * Restores the Dashboard role members of vaults that were disconnected before the members refresh
   * learned to leave them alone: `VaultViewer` answered with zero addresses for them, and the
   * refresh replaced the real rows with those zeros, cutting the Dashboard admins off from their own
   * vault. Reads them straight off the owner contract, bypassing the hub-centric `VaultViewer`.
   */
  private async repairDisconnectedVaultRoleMembers(blockNumber: number): Promise<void> {
    const batchSize = this.configService.jobs['vaultsBatchSize'];
    let afterId = 0;
    let repaired = 0;
    let skipped = 0;

    for (;;) {
      const vaults = await this.vaultDbService.getDisconnectedVaultsWithoutDashboardOwner(batchSize, afterId);
      if (vaults.length === 0) break;

      afterId = vaults[vaults.length - 1].id;

      await Promise.all(
        vaults.map(async (vault) => {
          const admins = await this.readVaultDashboardAdmins(vault, blockNumber);
          if (!admins?.length) {
            skipped++;
            return;
          }

          // Recorded exactly like a regular refresh would, so `membersOwnerAddress` is set to the
          // owner these roles came from and the vaults query starts trusting them.
          await this.vaultDbService.setMembersForVault(vault.address, {
            [STAKING_VAULT_OWNER_ROLE]: [vault.effectiveOwnerAddress as string],
            [DASHBOARD_OWNER_ROLE]: admins,
          });
          repaired++;
        }),
      );
    }

    if (repaired === 0 && skipped === 0) return;

    this.logger.log(
      `[backfillVaultOwnership] Disconnected vault role members: repaired=${repaired}, ` +
        `skipped=${skipped} (owner is not this vault's Dashboard, so it grants access by address only)`,
    );
  }

  /**
   * Dashboard admins of a disconnected vault, or `null` when the owner does not delegate access:
   * an EOA or an unrelated contract owns the vault outright and only its own address may see it.
   */
  private async readVaultDashboardAdmins(vault: VaultEntity, blockNumber: number): Promise<string[] | null> {
    const owner = vault.effectiveOwnerAddress;
    if (!owner || owner === constants.AddressZero) return null;

    try {
      const dashboard = this.dashboardContractFactory.get(owner);

      // Any AccessControl contract would answer `getRoleMembers`, so the owner has to prove it is
      // the Dashboard of this very vault before its admins are treated as the vault's owners.
      const boundVault = await dashboard.getStakingVault({ blockTag: blockNumber });
      if (boundVault.toLowerCase() !== vault.address.toLowerCase()) return null;

      const admins = await dashboard.getRoleMembers(DEFAULT_ADMIN_ROLE, { blockTag: blockNumber });
      return admins.filter((admin) => admin !== constants.AddressZero);
    } catch (err) {
      // Expected for a plain address owner: it implements neither `stakingVault()` nor AccessControl.
      this.logger.debug?.(
        `[backfillVaultOwnership] ${owner} is not the Dashboard of vault ${vault.address}: ${err}`,
      );
      return null;
    }
  }

  private async backfillSingleVaultOwnership(vault: VaultEntity, blockNumber: number): Promise<void> {
    if (!vault.isDisconnected) {
      const connectionOwner = await this.vaultHubContractService.getVaultOwner(vault.address, {
        blockTag: blockNumber,
      });
      await this.vaultDbService.connectVault(vault.address, blockNumber, connectionOwner);
      return;
    }

    // `membersOwnerAddress` is recovered separately from `vault_members`, which is the only place
    // the pre-disconnect owner is still recorded.
    const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(vault.address, blockNumber);
    await this.vaultDbService.disconnectVault(vault.address, blockNumber, effectiveOwner);
  }

  private async resolveDisconnectedEffectiveOwner(vault: string, blockNumber: number): Promise<string> {
    const stakingVault = this.stakingVaultContractFactory.get(vault);
    const { owner, pendingOwner } = await stakingVault.getOwnership({ blockTag: blockNumber });

    if (
      owner.toLowerCase() === this.vaultHubContractService.address.toLowerCase() &&
      pendingOwner !== constants.AddressZero
    ) {
      return pendingOwner;
    }

    return owner;
  }
}

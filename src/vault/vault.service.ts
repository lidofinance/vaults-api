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
import { constants, errors as ethersErrors } from 'ethers';

/**
 * ethers error codes that mean "this address does not implement the Dashboard interface" rather than
 * "the read failed". A plain EOA answers `eth_call` with `0x`, which ethers reports as CALL_EXCEPTION.
 */
const NOT_A_DASHBOARD_ERROR_CODES: ReadonlySet<string> = new Set([
  ethersErrors.CALL_EXCEPTION,
  ethersErrors.INVALID_ARGUMENT,
]);

/**
 * Sliding window of the ownership log scan, ~1 hour of mainnet blocks. Must exceed the scan cron
 * interval so consecutive windows overlap; the extra width lets a worker that was down for less
 * than the window catch up on its own. Anything older is the reconcile cron's job.
 */
const OWNERSHIP_LOGS_LOOKBACK_BLOCKS = 300;

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
          if (onChainVaultAddresses.has(dbAddress.toLowerCase())) continue;

          // Per-vault: resolving the owner is an on-chain read now, so a single flaky call must not
          // leave every later vault in this run still marked connected.
          try {
            const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(dbAddress, blockNumber);
            await this.vaultDbService.disconnectVault(dbAddress, blockNumber, effectiveOwner);
            this.logger.log(
              `[fetchAllVaultsAndCalculateStates] Set vault ${dbAddress} as disconnected (not returned by contract at block ${blockNumber})`,
            );
          } catch (err) {
            this.logger.error(
              `[fetchAllVaultsAndCalculateStates] Failed to mark vault ${dbAddress} as disconnected ` +
                `at block ${blockNumber}: ${err}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `[fetchAllVaultsAndCalculateStates] Failed to detect and set disconnected vaults at block ${blockNumber} — ${err}`,
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

          // `vaultData` is a plain read with no zero-response guard: when the node serves a state where
          // the connection is not visible yet, every address in the struct comes back zeroed. Writing
          // that would create a junk `0x000…0` vault row and blank the real vault's owner.
          if (item.vault === constants.AddressZero || item.connectionOwner === constants.AddressZero) {
            throw new Error(
              `VaultViewer returned no connection for vault ${vault} at block ${blockNumber} ` +
                `(vault=${item.vault}, connectionOwner=${item.connectionOwner})`,
            );
          }

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

          // The recorded roles were resolved through the previous owner, so from this block they no
          // longer describe who controls the vault: the query treats them as stale and the new owner's
          // delegates would be invisible until the daily members cron. Refresh them right away.
          await this.refreshVaultRoleMembers(vault, event.blockNumber, 'VaultOwnershipTransferred');

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

        // The flag and the owner have different failure domains: the flag is what the whole listing
        // depends on, the owner is a refinement that the 10-minute reconcile cron will retry anyway.
        // So a failed on-chain read must not stop the vault from being marked disconnected.
        let effectiveOwner: string | null = null;
        try {
          effectiveOwner = await this.resolveDisconnectedEffectiveOwner(vault, blockNumber);
        } catch (err) {
          this.logger.error(
            `[subscribeToEvents, event:VaultDisconnectCompleted] Failed to resolve the new owner of ${vault} ` +
              `at block ${blockNumber}, marking it disconnected without touching the recorded owner: ${err}`,
          );
        }

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
   * Event-driven counterpart of {@link reconcileDisconnectedVaultOwners} and the primary way owner
   * changes of disconnected vaults reach the DB: one `eth_getLogs` over the last
   * {@link OWNERSHIP_LOGS_LOOKBACK_BLOCKS} blocks instead of two `eth_call`s per vault, so the cost
   * does not grow with the number of disconnected vaults.
   *
   * The scan is a sliding window with no persisted cursor: consecutive windows overlap, and
   * re-applying an already-applied log is a no-op thanks to the monotonic `ownership_block_number`
   * guard. Downtime longer than the window is the reconcile cron's job.
   */
  @TrackJob('syncDisconnectedVaultOwnersFromLogs')
  @SingleFlight({ key: 'syncDisconnectedVaultOwnersFromLogs', log: true })
  public async syncDisconnectedVaultOwnersFromLogs(blockNumber: number): Promise<void> {
    const vaults = await this.vaultDbService.getAllDisconnectedVaultAddresses();
    if (vaults.length === 0) return;

    const disconnected = new Set(vaults.map((address) => address.toLowerCase()));
    const fromBlock = Math.max(blockNumber - OWNERSHIP_LOGS_LOOKBACK_BLOCKS + 1, 0);

    const logs = await this.stakingVaultContractFactory.getOwnershipTransferredLogs(fromBlock, blockNumber);

    // The topic is emitted by every OZ Ownable contract on the chain, so most logs are not ours.
    const vaultLogs = logs
      .filter((log) => disconnected.has(log.vault.toLowerCase()))
      // Several transfers of one vault in one block all pass the `<=` block guard, so they must be
      // applied in on-chain order for the last write to be the actual on-chain owner.
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

    this.logger.log(
      `[syncDisconnectedVaultOwnersFromLogs] Scanned blocks ${fromBlock}-${blockNumber}: ` +
        `${logs.length} OwnershipTransferred log(s), ${vaultLogs.length} for disconnected vault(s)`,
    );

    const hubAddress = this.vaultHubContractService.address.toLowerCase();

    for (const log of vaultLogs) {
      // A transfer back to the hub is the vault reconnecting: the `VaultConnected` handler and the
      // vaults cron own that transition — same rule as `resolveDisconnectedEffectiveOwner`.
      if (log.newOwner.toLowerCase() === hubAddress) continue;

      try {
        await this.vaultDbService.updateVaultOwnership(log.vault, log.newOwner, log.blockNumber, {
          onlyDisconnected: true,
        });
        this.logger.log(
          `[syncDisconnectedVaultOwnersFromLogs] Vault ${log.vault} transferred to ${log.newOwner} ` +
            `at block ${log.blockNumber}`,
        );
      } catch (err) {
        // Per-log isolation: the next window re-covers this log anyway, and the reconcile cron is
        // behind it — one failed write must not drop the rest of the batch.
        this.logger.error(
          `[syncDisconnectedVaultOwnersFromLogs] Failed to apply transfer of vault ${log.vault} ` +
            `at block ${log.blockNumber}: ${err}`,
        );
      }
    }

    this.prometheusService.lastUpdateGauge
      .labels({ source: 'syncDisconnectedVaultOwnersFromLogs', type: 'timestamp' })
      .set(Date.now() / 1000);
    this.prometheusService.lastUpdateGauge
      .labels({ source: 'syncDisconnectedVaultOwnersFromLogs', type: 'blockNumber' })
      .set(blockNumber);
  }

  /**
   * State-based safety net behind {@link syncDisconnectedVaultOwnersFromLogs}: re-reads the actual
   * `StakingVault` ownership of every disconnected vault, so it heals anything the log scan cannot
   * see — downtime longer than the scan window, and vaults whose disconnect handler failed to
   * resolve the owner. Costs two `eth_call`s per vault, which is why it runs rarely.
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
            if (effectiveOwner === null) {
              // Hub-owned at this block: the vault is connected again and the DB row is just stale.
              // The `VaultConnected` handler and the vaults cron own that transition.
              this.logger.log(
                `[reconcileDisconnectedVaultOwners] Vault ${vault} is owned by the VaultHub at block ` +
                  `${blockNumber}, leaving its recorded owner alone`,
              );
              return;
            }

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

    while (true) {
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
    let failed = 0;

    while (true) {
      const vaults = await this.vaultDbService.getDisconnectedVaultsWithoutDashboardOwner(batchSize, afterId);
      if (vaults.length === 0) break;

      afterId = vaults[vaults.length - 1].id;

      await Promise.all(
        vaults.map(async (vault) => {
          // Per-vault, because the cursor has already moved on: an unhandled rejection here would
          // abort the whole scan and the vaults after this batch would never be repaired.
          try {
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
          } catch (err) {
            failed++;
            this.logger.error(
              `[backfillVaultOwnership] Failed to repair role members of vault ${vault.address} ` +
                `at block ${blockNumber}: ${err}`,
            );
          }
        }),
      );
    }

    if (repaired === 0 && skipped === 0 && failed === 0) return;

    this.logger.log(
      `[backfillVaultOwnership] Disconnected vault role members: repaired=${repaired}, ` +
        `skipped=${skipped} (owner is not this vault's Dashboard, so it grants access by address only), ` +
        `failed=${failed}`,
    );

    // Surfaced so the caller can retry instead of dropping the one-off job on a transient RPC failure.
    if (failed > 0) {
      throw new Error(`[backfillVaultOwnership] Role members repair failed for ${failed} vault(s)`);
    }
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
      // Only a revert (or an EOA answering `0x`) proves the owner is not a Dashboard. Everything else
      // — RPC down, timeout, rate limit — must propagate: swallowing it here would mark the vault
      // "not a Dashboard" forever and quietly cut its admins off from their own vault.
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : undefined;
      if (!NOT_A_DASHBOARD_ERROR_CODES.has(code)) throw err;

      this.logger.debug(`[backfillVaultOwnership] ${owner} is not the Dashboard of vault ${vault.address}: ${err}`);
      return null;
    }
  }

  private async backfillSingleVaultOwnership(vault: VaultEntity, blockNumber: number): Promise<void> {
    if (vault.isDisconnected) {
      // `membersOwnerAddress` is recovered separately from `vault_members`, which is the only place
      // the pre-disconnect owner is still recorded.
      const effectiveOwner = await this.resolveDisconnectedEffectiveOwner(vault.address, blockNumber);
      if (effectiveOwner !== null) {
        await this.vaultDbService.disconnectVault(vault.address, blockNumber, effectiveOwner);
        return;
      }

      // Hub-owned, so the `is_disconnected` flag is wrong: rows are also created by the report import,
      // which has no way to tell and defaults to disconnected. Resolve it as connected instead of
      // trusting the flag — the chain is the authority here.
      this.logger.log(
        `[backfillVaultOwnership] Vault ${vault.address} is flagged disconnected but owned by the VaultHub ` +
          `at block ${blockNumber}, resolving it as connected`,
      );
    }

    const connectionOwner = await this.vaultHubContractService.getVaultOwner(vault.address, {
      blockTag: blockNumber,
    });

    if (connectionOwner === constants.AddressZero) {
      // Neither the hub nor the vault names an owner: nothing to record, and writing the zero address
      // would look like a resolved owner and stop the backfill from ever retrying this vault.
      this.logger.warn(
        `[backfillVaultOwnership] Vault ${vault.address} has no owner in the VaultHub at block ${blockNumber}, skipping`,
      );
      return;
    }

    await this.vaultDbService.connectVault(vault.address, blockNumber, connectionOwner);
  }

  /**
   * Re-reads the role members of a single vault. Failures are logged and swallowed: the caller has
   * already recorded the ownership change, which is the part the listing depends on, and the daily
   * members cron will retry. Losing the whole event handler over a role refresh would be worse.
   */
  private async refreshVaultRoleMembers(vault: string, blockNumber: number, context: string): Promise<void> {
    try {
      const roleMembersMap = await this.vaultViewerContractService.getRoleMembersWithRetry(vault, ROLE_BYTES32, {
        blockTag: blockNumber,
      });
      await this.vaultDbService.setMembersForVault(vault, roleMembersMap);
      this.logger.log(`[${context}] Refreshed role members of vault ${vault} at block ${blockNumber}`);
    } catch (err) {
      this.logger.error(
        `[${context}] Failed to refresh role members of vault ${vault} at block ${blockNumber}, ` +
          `they stay marked stale until the members cron runs: ${err}`,
      );
    }
  }

  /**
   * The address to show as the owner of a vault that is no longer in the hub, or `null` when the
   * `StakingVault` says nothing useful yet.
   *
   * `StakingVault` is `Ownable2Step`, so ownership arrives in two steps and every step reads
   * differently:
   * - `owner` is the `VaultHub` and `pendingOwner` is set — the disconnect completed and the hub
   *   handed the vault to the Dashboard, which has not accepted yet. That pending address is the one
   *   the user recognises, so it is what we record.
   * - `owner` is the `VaultHub` and there is no pending owner — the vault is hub-owned, i.e. it is
   *   (again) connected and this read is simply behind the DB. Recording the `VaultHub` here would
   *   hide the vault from its real owner, so we record nothing and let the connected path do it.
   * - anything else — `owner` is a Dashboard or a plain address that already accepted. Note that a
   *   further `pendingOwner` (an `abandonDashboard` awaiting `acceptOwnership`) is deliberately
   *   ignored: until the handover is accepted, the vault still belongs to the current owner.
   */
  private async resolveDisconnectedEffectiveOwner(vault: string, blockNumber: number): Promise<string | null> {
    const stakingVault = this.stakingVaultContractFactory.get(vault);
    const { owner, pendingOwner } = await stakingVault.getOwnership({ blockTag: blockNumber });

    if (owner.toLowerCase() === this.vaultHubContractService.address.toLowerCase()) {
      return pendingOwner === constants.AddressZero ? null : pendingOwner;
    }

    return owner;
  }
}

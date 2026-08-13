import { constants } from 'ethers';

jest.mock('common/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('lsv', () => ({
  LsvService: class LsvService {},
}));

import { VaultService } from './vault.service';

describe('VaultService ownership lifecycle', () => {
  const vault = '0x1111111111111111111111111111111111111111';
  const vaultHub = '0x2222222222222222222222222222222222222222';
  const dashboard = '0x3333333333333333333333333333333333333333';
  const directOwner = '0x4444444444444444444444444444444444444444';
  const dashboardAdmin = '0x6666666666666666666666666666666666666666';

  let hubListeners: Record<string, (...args: any[]) => Promise<void>>;
  let vaultDbService: any;
  let vaultViewerContractService: any;
  let vaultHubContractService: any;
  let stakingVault: any;
  let dashboardContract: any;
  let stakingVaultContractFactory: any;
  let dashboardContractFactory: any;
  let service: VaultService;

  /** An ethers revert, as produced by calling a contract method on an EOA or on the wrong interface. */
  const callException = () => Object.assign(new Error('call revert exception'), { code: 'CALL_EXCEPTION' });

  beforeEach(() => {
    hubListeners = {};

    vaultDbService = {
      getAllDisconnectedVaultAddresses: jest.fn().mockResolvedValue([]),
      getVaultsWithoutOwnership: jest.fn().mockResolvedValue([]),
      getDisconnectedVaultsWithStaleMembers: jest.fn().mockResolvedValue([]),
      countVaultsWithoutOwnership: jest.fn().mockResolvedValue(0),
      countDisconnectedVaultsWithStaleMembers: jest.fn().mockResolvedValue(0),
      backfillMembersOwnerFromRoleMembers: jest.fn().mockResolvedValue(0),
      getOrCreateVaultByAddress: jest.fn().mockResolvedValue({ id: 1, address: vault }),
      getVaultsCount: jest.fn().mockResolvedValue(0),
      getVaults: jest.fn().mockResolvedValue([]),
      connectVault: jest.fn().mockResolvedValue(undefined),
      disconnectVault: jest.fn().mockResolvedValue(undefined),
      updateVaultOwnership: jest.fn().mockResolvedValue(undefined),
      addOrUpdateState: jest.fn().mockResolvedValue(undefined),
      setMembersForVault: jest.fn().mockResolvedValue(undefined),
    };

    vaultViewerContractService = {
      getVaultData: jest.fn().mockResolvedValue({
        vault,
        connectionOwner: dashboard,
        totalValue: 100n,
        liabilityShares: 0n,
        liabilityStETH: 0n,
        shareLimit: 100n,
        reserveRatioBP: 2000,
        forcedRebalanceThresholdBP: 1800,
        infraFeeBP: 500,
        liquidityFeeBP: 400,
        reservationFeeBP: 100,
        nodeOperatorFeeRate: 100n,
        isReportFresh: true,
        isQuarantineActive: false,
        quarantinePendingTotalValueIncrease: 0n,
        quarantineStartTimestamp: 0,
        quarantineEndTimestamp: 0,
      }),
      getRoleMembersWithRetry: jest.fn().mockResolvedValue({}),
      getRoleMembersBatch: jest.fn().mockResolvedValue([]),
    };

    vaultHubContractService = {
      address: vaultHub,
      getVaultOwner: jest.fn().mockResolvedValue(dashboard),
      contract: {
        on: jest.fn((eventName, listener) => {
          hubListeners[eventName] = listener;
        }),
      },
    };

    // VaultHub hands the vault back with Ownable2Step, so right after a disconnect the owner is
    // still the hub and the Dashboard sits in pendingOwner until it accepts.
    stakingVault = {
      getOwnership: jest.fn().mockResolvedValue({ owner: vaultHub, pendingOwner: dashboard }),
    };

    dashboardContract = {
      getStakingVault: jest.fn().mockResolvedValue(vault),
      getRoleMembers: jest.fn().mockResolvedValue([dashboardAdmin]),
    };

    // Both factories are keyed by address in production — `dashboardContractFactory` resolves a Dashboard
    // by the vault's *owner*, not by the vault — so the mocks record what they were asked for.
    stakingVaultContractFactory = {
      get: jest.fn(() => stakingVault),
      getOwnershipTransferredLogs: jest.fn().mockResolvedValue([]),
    };
    dashboardContractFactory = { get: jest.fn(() => dashboardContract) };

    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const counter = { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) };
    const gauge = { labels: jest.fn().mockReturnValue({ set: jest.fn() }) };
    const prometheusService = {
      contractEventHandledCounter: counter,
      lastUpdateGauge: gauge,
      ownershipBacklogGauge: gauge,
      jobDuration: { startTimer: jest.fn(() => jest.fn(() => 0)) },
    };

    service = new VaultService(
      { jobs: { vaultsBatchSize: 10, vaultMembersBatchSize: 10 }, get: jest.fn() } as any,
      {} as any,
      logger as any,
      vaultDbService,
      vaultViewerContractService,
      vaultHubContractService,
      stakingVaultContractFactory as any,
      dashboardContractFactory as any,
      { calculateHealth: jest.fn().mockResolvedValue({ healthRatio: 1 }) } as any,
      prometheusService as any,
    );
  });

  describe('VaultHub events', () => {
    it('marks a completed disconnect with the pending owner', async () => {
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(stakingVault.getOwnership).toHaveBeenCalledWith({ blockTag: 100 });
      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, dashboard);
    });

    it('uses the current owner when VaultHub is not the owner anymore', async () => {
      stakingVault.getOwnership.mockResolvedValue({ owner: directOwner, pendingOwner: constants.AddressZero });
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, directOwner);
    });

    // `abandonDashboard(newOwner)` accepts the handover from the hub and immediately starts a second
    // one, so the Dashboard is the owner and the new owner is only pending. Deliberate product
    // decision: until that handover is accepted the vault still belongs to the Dashboard, so its
    // admins keep it and the new owner does not see it yet.
    it('keeps the Dashboard as the owner until the new owner accepts', async () => {
      const newOwner = '0x5151515151515151515151515151515151515151';
      stakingVault.getOwnership.mockResolvedValue({ owner: dashboard, pendingOwner: newOwner });
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, dashboard);
    });

    // The hub owning the vault with nothing pending means it is connected, not disconnected. Recording
    // the hub as the owner would hide the vault from everyone who actually controls it.
    it('never records the VaultHub itself as the owner', async () => {
      stakingVault.getOwnership.mockResolvedValue({ owner: vaultHub, pendingOwner: constants.AddressZero });
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, null);
    });

    it('compares the VaultHub address case-insensitively', async () => {
      vaultHubContractService.address = vaultHub.toUpperCase().replace('0X', '0x');
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, dashboard);
    });

    // The flag drives the whole listing; the owner is a refinement the reconcile cron retries anyway.
    it('still marks the vault disconnected when the ownership read fails', async () => {
      stakingVault.getOwnership.mockRejectedValue(new Error('rpc is down'));
      await service.subscribeToEvents();

      await hubListeners.VaultDisconnectCompleted(vault, { blockNumber: 100 });

      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 100, null);
    });

    it('stores the connection owner as the effective owner on VaultConnected', async () => {
      await service.subscribeToEvents();

      await hubListeners.VaultConnected(vault, 0n, 0n, 0n, 0n, 0n, 0n, { blockNumber: 102 });

      expect(vaultDbService.connectVault).toHaveBeenCalledWith(vault, 102, dashboard);
    });

    // `vaultData` is a plain read: a node serving a state where the connection is not visible yet
    // returns a fully zeroed struct, which would create a junk `0x000…0` vault row and blank the real
    // vault's owner.
    it('writes nothing when VaultViewer reports no connection', async () => {
      vaultViewerContractService.getVaultData.mockResolvedValue({
        ...(await vaultViewerContractService.getVaultData()),
        vault: constants.AddressZero,
        connectionOwner: constants.AddressZero,
      });
      await service.subscribeToEvents();

      await hubListeners.VaultConnected(vault, 0n, 0n, 0n, 0n, 0n, 0n, { blockNumber: 102 });

      expect(vaultDbService.getOrCreateVaultByAddress).not.toHaveBeenCalled();
      expect(vaultDbService.connectVault).not.toHaveBeenCalled();
      expect(vaultDbService.addOrUpdateState).not.toHaveBeenCalled();
    });

    it('follows the connection owner while the vault stays connected', async () => {
      await service.subscribeToEvents();

      await hubListeners.VaultOwnershipTransferred(vault, directOwner, dashboard, { blockNumber: 103 });

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledWith(vault, directOwner, 103);
    });
  });

  describe('reconcileDisconnectedVaultOwners', () => {
    it('re-reads ownership of every disconnected vault', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      stakingVault.getOwnership.mockResolvedValue({ owner: directOwner, pendingOwner: constants.AddressZero });

      await service.reconcileDisconnectedVaultOwners(200);

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledWith(vault, directOwner, 200, {
        onlyDisconnected: true,
      });
    });

    // Reading a lagging safe block can catch a vault that has already reconnected. The hub owning it
    // is not an owner to record — the connected path owns that transition.
    it('leaves the recorded owner alone when the vault is hub-owned again', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      stakingVault.getOwnership.mockResolvedValue({ owner: vaultHub, pendingOwner: constants.AddressZero });

      await service.reconcileDisconnectedVaultOwners(200);

      expect(vaultDbService.updateVaultOwnership).not.toHaveBeenCalled();
    });

    it('reads ownership of the vault itself, not of its owner', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);

      await service.reconcileDisconnectedVaultOwners(200);

      expect(stakingVaultContractFactory.get).toHaveBeenCalledWith(vault);
    });

    it('keeps going when a single vault fails', async () => {
      const otherVault = '0x5555555555555555555555555555555555555555';
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault, otherVault]);
      stakingVault.getOwnership
        .mockRejectedValueOnce(new Error('rpc is down'))
        .mockResolvedValueOnce({ owner: directOwner, pendingOwner: constants.AddressZero });

      await service.reconcileDisconnectedVaultOwners(200);

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledTimes(1);
      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledWith(otherVault, directOwner, 200, {
        onlyDisconnected: true,
      });
    });
  });

  describe('syncDisconnectedVaultOwnersFromLogs', () => {
    const transfer = (overrides: Record<string, unknown> = {}) => ({
      vault,
      previousOwner: dashboard,
      newOwner: directOwner,
      blockNumber: 190,
      logIndex: 0,
      ...overrides,
    });

    it('does not touch the chain when there are no disconnected vaults', async () => {
      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(stakingVaultContractFactory.getOwnershipTransferredLogs).not.toHaveBeenCalled();
    });

    it('applies a transfer of a disconnected vault at the block of the log, not of the scan', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([transfer()]);

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledWith(vault, directOwner, 190, {
        onlyDisconnected: true,
      });
    });

    // The topic is the generic OZ Ownable event: the scan sees transfers of every contract on the
    // chain, and only the disconnected vaults' ones may reach the DB.
    it('ignores transfers of contracts that are not disconnected vaults', async () => {
      const stranger = '0x9999999999999999999999999999999999999999';
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([transfer({ vault: stranger })]);

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(vaultDbService.updateVaultOwnership).not.toHaveBeenCalled();
    });

    it('matches vault addresses case-insensitively', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault.toUpperCase().replace('0X', '0x')]);
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([transfer()]);

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledTimes(1);
    });

    it('skips a transfer back to the VaultHub — that is the vault reconnecting', async () => {
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([transfer({ newOwner: vaultHub })]);

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(vaultDbService.updateVaultOwnership).not.toHaveBeenCalled();
    });

    it('applies same-block transfers in log order so the last one wins', async () => {
      const finalOwner = '0x7777777777777777777777777777777777777777';
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault]);
      // Returned out of order on purpose: the on-chain order is (logIndex 1) → (logIndex 3).
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([
        transfer({ newOwner: finalOwner, blockNumber: 190, logIndex: 3 }),
        transfer({ newOwner: directOwner, blockNumber: 190, logIndex: 1 }),
      ]);

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      const calls = vaultDbService.updateVaultOwnership.mock.calls;
      expect(calls.map((call: unknown[]) => call[1])).toEqual([directOwner, finalOwner]);
    });

    it('keeps applying the remaining transfers when one write fails', async () => {
      const otherVault = '0x5555555555555555555555555555555555555555';
      vaultDbService.getAllDisconnectedVaultAddresses.mockResolvedValue([vault, otherVault]);
      stakingVaultContractFactory.getOwnershipTransferredLogs.mockResolvedValue([
        transfer({ blockNumber: 190 }),
        transfer({ vault: otherVault, blockNumber: 191 }),
      ]);
      vaultDbService.updateVaultOwnership.mockRejectedValueOnce(new Error('db is down'));

      await service.syncDisconnectedVaultOwnersFromLogs(200);

      expect(vaultDbService.updateVaultOwnership).toHaveBeenCalledTimes(2);
      expect(vaultDbService.updateVaultOwnership).toHaveBeenLastCalledWith(otherVault, directOwner, 191, {
        onlyDisconnected: true,
      });
    });
  });

  describe('backfillVaultOwnership', () => {
    it('recovers the members provenance from vault_members before resolving owners', async () => {
      vaultDbService.backfillMembersOwnerFromRoleMembers.mockResolvedValue(42);

      await service.backfillVaultOwnership(300);

      expect(vaultDbService.backfillMembersOwnerFromRoleMembers).toHaveBeenCalledTimes(1);
    });

    it('does nothing when every vault already has its ownership resolved', async () => {
      await service.backfillVaultOwnership(300);

      expect(vaultDbService.connectVault).not.toHaveBeenCalled();
      expect(vaultDbService.disconnectVault).not.toHaveBeenCalled();
    });

    it('takes the connection owner from VaultHub for a connected vault', async () => {
      vaultDbService.getVaultsWithoutOwnership
        .mockResolvedValueOnce([{ id: 7, address: vault, isDisconnected: false }])
        .mockResolvedValueOnce([]);

      await service.backfillVaultOwnership(300);

      expect(vaultHubContractService.getVaultOwner).toHaveBeenCalledWith(vault, { blockTag: 300 });
      expect(vaultDbService.connectVault).toHaveBeenCalledWith(vault, 300, dashboard);
    });

    it('reads StakingVault ownership for a disconnected vault', async () => {
      vaultDbService.getVaultsWithoutOwnership
        .mockResolvedValueOnce([{ id: 7, address: vault, isDisconnected: true }])
        .mockResolvedValueOnce([]);
      stakingVault.getOwnership.mockResolvedValue({ owner: directOwner, pendingOwner: constants.AddressZero });

      await service.backfillVaultOwnership(300);

      expect(vaultHubContractService.getVaultOwner).not.toHaveBeenCalled();
      expect(vaultDbService.disconnectVault).toHaveBeenCalledWith(vault, 300, directOwner);
    });

    it('restores the Dashboard admins of a disconnected vault whose role rows were wiped', async () => {
      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: dashboard }])
        .mockResolvedValueOnce([]);

      await service.backfillVaultOwnership(300);

      expect(dashboardContract.getStakingVault).toHaveBeenCalledWith({ blockTag: 300 });
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(
        vault,
        {
          'vaults.StakingVault.owner': [dashboard],
          'vaults.Dashboard.owner': [dashboardAdmin],
        },
        300,
      );
    });

    it("grants no role access when the owner is not this vault's Dashboard", async () => {
      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: directOwner }])
        .mockResolvedValueOnce([]);
      dashboardContract.getStakingVault.mockResolvedValue('0x9999999999999999999999999999999999999999');

      await service.backfillVaultOwnership(300);

      expect(dashboardContract.getRoleMembers).not.toHaveBeenCalled();
      // Owner-only write: records the provenance and, in the same transaction, drops any rows left by
      // a previous owner — recording the provenance alone would re-enable them.
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(
        vault,
        { 'vaults.StakingVault.owner': [directOwner] },
        300,
      );
    });

    // Otherwise every restart re-reads the same vaults on-chain forever.
    it('records the provenance of a plain-address owner so it is not re-read', async () => {
      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: directOwner }])
        .mockResolvedValueOnce([]);
      // An EOA answers `eth_call` with `0x`, which ethers surfaces as CALL_EXCEPTION.
      dashboardContract.getStakingVault.mockRejectedValue(callException());

      await service.backfillVaultOwnership(300);

      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(
        vault,
        { 'vaults.StakingVault.owner': [directOwner] },
        300,
      );
    });

    // A transient RPC failure looks nothing like a revert, and treating it as "not a Dashboard" would
    // leave the vault's admins locked out for good: the repair only ever runs from the startup backfill.
    it('does not mistake an unreachable RPC for a plain-address owner', async () => {
      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: dashboard }])
        .mockResolvedValueOnce([]);
      dashboardContract.getStakingVault.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'TIMEOUT' }));

      await expect(service.backfillVaultOwnership(300)).rejects.toThrow(/repair failed for 1 vault/);
      expect(vaultDbService.setMembersForVault).not.toHaveBeenCalled();
    });

    it('repairs the remaining vaults when one of them fails', async () => {
      const otherVault = '0x7777777777777777777777777777777777777777';
      const otherDashboard = '0x8888888888888888888888888888888888888888';

      // One Dashboard per vault, resolved by owner address — the same shape as production.
      const boundVaultByDashboard: Record<string, string> = {
        [dashboard]: vault,
        [otherDashboard]: otherVault,
      };
      dashboardContractFactory.get.mockImplementation((owner: string) => ({
        getStakingVault: jest.fn().mockResolvedValue(boundVaultByDashboard[owner]),
        getRoleMembers: jest.fn().mockResolvedValue([dashboardAdmin]),
      }));

      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([
          { id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: dashboard },
          { id: 10, address: otherVault, isDisconnected: true, effectiveOwnerAddress: otherDashboard },
        ])
        .mockResolvedValueOnce([]);
      vaultDbService.setMembersForVault.mockImplementation(async (address: string) => {
        if (address === vault) throw new Error('deadlock detected');
      });

      await expect(service.backfillVaultOwnership(300)).rejects.toThrow(/repair failed for 1 vault/);

      // The failing vault must not take the ones after it down with it.
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(otherVault, expect.anything(), 300);
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledTimes(2);
    });

    it('resolves the Dashboard by the vault owner, not by the vault address', async () => {
      vaultDbService.getDisconnectedVaultsWithStaleMembers
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: dashboard }])
        .mockResolvedValueOnce([]);

      await service.backfillVaultOwnership(300);

      expect(dashboardContractFactory.get).toHaveBeenCalledWith(dashboard);
    });

    it('advances the cursor past a failing vault instead of rescanning it', async () => {
      vaultDbService.getVaultsWithoutOwnership
        .mockResolvedValueOnce([{ id: 7, address: vault, isDisconnected: false }])
        .mockResolvedValueOnce([]);
      vaultHubContractService.getVaultOwner.mockRejectedValue(new Error('rpc is down'));

      // Surfaced so the one-off job retries instead of being dropped with work left over.
      await expect(service.backfillVaultOwnership(300)).rejects.toThrow(/Owner resolution failed for 1 vault/);

      expect(vaultDbService.getVaultsWithoutOwnership).toHaveBeenNthCalledWith(1, 10, 0);
      expect(vaultDbService.getVaultsWithoutOwnership).toHaveBeenNthCalledWith(2, 10, 7);
    });
  });
  describe('fetchAllVaultsRoleMembers', () => {
    const zeroResponse = {
      'vaults.StakingVault.owner': [constants.AddressZero],
      'vaults.StakingVault.nodeOperator': [constants.AddressZero],
    };
    const realResponse = {
      'vaults.StakingVault.owner': [dashboard],
      'vaults.StakingVault.nodeOperator': [directOwner],
      'vaults.Dashboard.owner': [dashboardAdmin],
    };

    beforeEach(() => {
      vaultDbService.getVaultsCount.mockResolvedValue(1);
      vaultDbService.getVaults.mockResolvedValueOnce([{ id: 1, address: vault }]).mockResolvedValue([]);
    });

    it('only walks connected vaults', async () => {
      await service.fetchAllVaultsRoleMembers(400);

      expect(vaultDbService.getVaultsCount).toHaveBeenCalledWith({ isDisconnected: false });
      // The batch is capped by the total, which is 1 here.
      expect(vaultDbService.getVaults).toHaveBeenCalledWith(1, 0, { isDisconnected: false });
    });

    it('stores the members of a resolved vault together with the block they were read at', async () => {
      vaultViewerContractService.getRoleMembersBatch.mockResolvedValue([
        { vault, roleMembersMap: realResponse, resolved: true },
      ]);

      await service.fetchAllVaultsRoleMembers(400);

      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(vault, realResponse, 400);
    });

    // The viewer answers with zero addresses instead of reverting when it cannot resolve a vault.
    // Persisting that would delete the real members and lock the owner out of their own vault.
    it('keeps the stored members when the viewer answers with zero addresses', async () => {
      vaultViewerContractService.getRoleMembersBatch.mockResolvedValue([
        { vault, roleMembersMap: zeroResponse, resolved: false },
      ]);

      await service.fetchAllVaultsRoleMembers(400);

      expect(vaultDbService.setMembersForVault).not.toHaveBeenCalled();
    });

    it('still stores the resolved vaults of a batch that also contains an unresolved one', async () => {
      const otherVault = '0x7777777777777777777777777777777777777777';
      vaultViewerContractService.getRoleMembersBatch.mockResolvedValue([
        { vault, roleMembersMap: zeroResponse, resolved: false },
        { vault: otherVault, roleMembersMap: realResponse, resolved: true },
      ]);

      await service.fetchAllVaultsRoleMembers(400);

      expect(vaultDbService.setMembersForVault).toHaveBeenCalledTimes(1);
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(otherVault, realResponse, 400);
    });
  });
});

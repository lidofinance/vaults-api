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
  let service: VaultService;

  beforeEach(() => {
    hubListeners = {};

    vaultDbService = {
      getAllDisconnectedVaultAddresses: jest.fn().mockResolvedValue([]),
      getVaultsWithoutOwnership: jest.fn().mockResolvedValue([]),
      getDisconnectedVaultsWithoutDashboardOwner: jest.fn().mockResolvedValue([]),
      backfillMembersOwnerFromRoleMembers: jest.fn().mockResolvedValue(0),
      getOrCreateVaultByAddress: jest.fn().mockResolvedValue({ id: 1, address: vault }),
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

    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const counter = { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) };
    const gauge = { labels: jest.fn().mockReturnValue({ set: jest.fn() }) };
    const prometheusService = {
      contractEventHandledCounter: counter,
      lastUpdateGauge: gauge,
      jobDuration: { startTimer: jest.fn(() => jest.fn(() => 0)) },
    };

    service = new VaultService(
      { jobs: { vaultsBatchSize: 10 }, get: jest.fn() } as any,
      {} as any,
      logger as any,
      vaultDbService,
      vaultViewerContractService,
      vaultHubContractService,
      { get: jest.fn(() => stakingVault) } as any,
      { get: jest.fn(() => dashboardContract) } as any,
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

    it('stores the connection owner as the effective owner on VaultConnected', async () => {
      await service.subscribeToEvents();

      await hubListeners.VaultConnected(vault, 0n, 0n, 0n, 0n, 0n, 0n, { blockNumber: 102 });

      expect(vaultDbService.connectVault).toHaveBeenCalledWith(vault, 102, dashboard);
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
      vaultDbService.getDisconnectedVaultsWithoutDashboardOwner
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: dashboard }])
        .mockResolvedValueOnce([]);

      await service.backfillVaultOwnership(300);

      expect(dashboardContract.getStakingVault).toHaveBeenCalledWith({ blockTag: 300 });
      expect(vaultDbService.setMembersForVault).toHaveBeenCalledWith(vault, {
        'vaults.StakingVault.owner': [dashboard],
        'vaults.Dashboard.owner': [dashboardAdmin],
      });
    });

    it('leaves a disconnected vault alone when its owner is not this vault\'s Dashboard', async () => {
      vaultDbService.getDisconnectedVaultsWithoutDashboardOwner
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: directOwner }])
        .mockResolvedValueOnce([]);
      dashboardContract.getStakingVault.mockResolvedValue('0x9999999999999999999999999999999999999999');

      await service.backfillVaultOwnership(300);

      expect(dashboardContract.getRoleMembers).not.toHaveBeenCalled();
      expect(vaultDbService.setMembersForVault).not.toHaveBeenCalled();
    });

    it('leaves a disconnected vault alone when the owner is a plain address', async () => {
      vaultDbService.getDisconnectedVaultsWithoutDashboardOwner
        .mockResolvedValueOnce([{ id: 9, address: vault, isDisconnected: true, effectiveOwnerAddress: directOwner }])
        .mockResolvedValueOnce([]);
      dashboardContract.getStakingVault.mockRejectedValue(new Error('call revert exception'));

      await service.backfillVaultOwnership(300);

      expect(vaultDbService.setMembersForVault).not.toHaveBeenCalled();
    });

    it('advances the cursor past a failing vault instead of rescanning it', async () => {
      vaultDbService.getVaultsWithoutOwnership
        .mockResolvedValueOnce([{ id: 7, address: vault, isDisconnected: false }])
        .mockResolvedValueOnce([]);
      vaultHubContractService.getVaultOwner.mockRejectedValue(new Error('rpc is down'));

      await service.backfillVaultOwnership(300);

      expect(vaultDbService.getVaultsWithoutOwnership).toHaveBeenNthCalledWith(1, 10, 0);
      expect(vaultDbService.getVaultsWithoutOwnership).toHaveBeenNthCalledWith(2, 10, 7);
    });
  });
});

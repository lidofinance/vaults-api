import { Injectable } from '@nestjs/common';
import { Contract, constants } from 'ethers';

import { LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerAbi } from 'common/contracts/abi/VaultViewer';
import { callWithRetry } from 'common/utils/rpc-call-with-retry';
import { STAKING_VAULT_OWNER_ROLE, STAKING_VAULT_NODE_OPERATOR_ROLE, ROLE_KEYS } from 'vault/vault.constants';

export type Overrides = { blockTag?: number | string };

export type VaultData = {
  vault: string;
  totalValue: bigint;
  liabilityShares: bigint;
  liabilityStETH: bigint;
  shareLimit: bigint;
  reserveRatioBP: number;
  forcedRebalanceThresholdBP: number;
  infraFeeBP: number;
  liquidityFeeBP: number;
  reservationFeeBP: number;
  nodeOperatorFeeRate: bigint;
  isReportFresh: boolean;
  isQuarantineActive: boolean;
  quarantinePendingTotalValueIncrease: bigint;
  quarantineStartTimestamp: number;
  quarantineEndTimestamp: number;
};

export type RoleMembers = Record<string, string[]>;

export type RawVaultRoleMembers = [
  string, // owner
  string, // nodeOperator
  string, // depositor
  string[][], // members
];

@Injectable()
export class VaultViewerContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string, private readonly logger: LoggerService) {
    if (!address) throw new Error('VaultViewer contract address is not defined');
    this.contract = new Contract(address, VaultViewerAbi, provider);
  }

  async getVaultsConnectedBound(
    from: number,
    to: number,
    overrides?: Overrides,
  ): Promise<{ addresses: string[]; leftoverVaults: number }> {
    const [addresses, leftoverVaults] = await this.contract.vaultsConnectedBound(from, to, overrides);
    // leftoverVaults.toNumber() is safe here!
    return { addresses, leftoverVaults: leftoverVaults.toNumber() };
  }

  async getVaultData(vault: string, overrides?: Overrides): Promise<VaultData> {
    const raw = await this.contract.getVaultData(vault, overrides);
    return VaultViewerContractService.transformVaultData(raw);
  }

  async getVaultsDataBound(
    from: number,
    to: number,
    overrides?: Overrides,
  ): Promise<{ vaultsDataBatch: VaultData[]; leftover: number }> {
    const [rawVaultsData, leftover] = await this.contract.getVaultsDataBound(from, to, overrides);
    return {
      vaultsDataBatch: rawVaultsData.map(VaultViewerContractService.transformVaultData),
      leftover,
    };
  }

  async getRoleMembers(vaultAddress: string, roles: string[], overrides?: Overrides): Promise<RoleMembers> {
    const [, owner, nodeOperator, membersRaw]: RawVaultRoleMembers = await this.contract.getRoleMembers(
      vaultAddress,
      roles,
      overrides,
    );

    return VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw);
  }

  async getRoleMembersWithRetry(vaultAddress: string, roles: string[], overrides?: Overrides): Promise<RoleMembers> {
    const result = await callWithRetry(
      async () => {
        const [, owner, nodeOperator, membersRaw]: RawVaultRoleMembers = await this.contract.getRoleMembers(
          vaultAddress,
          roles,
          overrides,
        );
        return { owner, nodeOperator, membersRaw };
      },
      {
        callName: 'getRoleMembers',
        logger: this.logger,
        acceptResult: ({ owner, nodeOperator }) =>
          owner !== constants.AddressZero && nodeOperator !== constants.AddressZero,
      },
    );

    const { owner, nodeOperator, membersRaw } = result;

    return VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw);
  }

  async getRoleMembersBatch(
    vaultAddresses: string[],
    roles: string[],
    overrides?: Overrides,
  ): Promise<Array<{ vault: string; roleMembersMap: RoleMembers }>> {
    const raw: RawVaultRoleMembers[] = await this.contract.getRoleMembersBatch(vaultAddresses, roles, overrides);

    return raw.map(([vault, owner, nodeOperator, membersRaw]) => ({
      vault,
      roleMembersMap: VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw),
    }));
  }

  private static transformVaultData(vaultData: any): VaultData {
    return {
      vault: vaultData.vaultAddress,
      totalValue: vaultData.totalValue.toBigInt(),
      liabilityShares: vaultData.record.liabilityShares.toBigInt(),
      liabilityStETH: vaultData.liabilityStETH.toBigInt(),
      shareLimit: vaultData.connection.shareLimit.toBigInt(),
      reserveRatioBP: vaultData.connection.reserveRatioBP,
      forcedRebalanceThresholdBP: vaultData.connection.forcedRebalanceThresholdBP,
      infraFeeBP: vaultData.connection.infraFeeBP,
      liquidityFeeBP: vaultData.connection.liquidityFeeBP,
      reservationFeeBP: vaultData.connection.reservationFeeBP,
      nodeOperatorFeeRate: vaultData.nodeOperatorFeeRate.toBigInt(),
      isReportFresh: vaultData.isReportFresh,
      isQuarantineActive: vaultData.quarantineInfo.isActive,
      quarantinePendingTotalValueIncrease: vaultData.quarantineInfo.pendingTotalValueIncrease.toBigInt(),
      // toNumber() safe here!
      quarantineStartTimestamp: vaultData.quarantineInfo.startTimestamp.toNumber(),
      // toNumber() safe here!
      quarantineEndTimestamp: vaultData.quarantineInfo.endTimestamp.toNumber(),
    };
  }

  private static transformRoleMembersMap(owner: string, nodeOperator: string, membersRaw: string[][]): RoleMembers {
    const map: RoleMembers = {
      [STAKING_VAULT_OWNER_ROLE]: [owner],
      [STAKING_VAULT_NODE_OPERATOR_ROLE]: [nodeOperator],
    };

    for (let i = 0; i < ROLE_KEYS.length; i++) {
      const m = membersRaw[i] || [];
      if (m.length > 0) {
        map[ROLE_KEYS[i]] = m;
      }
    }

    return map;
  }
}

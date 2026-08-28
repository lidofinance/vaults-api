import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';
import { zeroAddress } from 'viem';

import { LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerAbi } from 'common/contracts/abi/VaultViewer';
import { rpcCallWithRetry } from 'common/utils/rpc-call-with-retry';
import { STAKING_VAULT_OWNER_ROLE, STAKING_VAULT_NODE_OPERATOR_ROLE, ROLE_KEYS } from 'vault/vault.constants';

export type Overrides = { blockTag?: number | string };

export type VaultData = {
  vault: string;
  connectionOwner: string;
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
  accruedFee: bigint;
  isReportFresh: boolean;
  isQuarantineActive: boolean;
  quarantinePendingTotalValueIncrease: bigint;
  quarantineStartTimestamp: number;
  quarantineEndTimestamp: number;
};

export type RoleMembers = Record<string, string[]>;

export type VaultRoleMembers = {
  vault: string;
  roleMembersMap: RoleMembers;
  /** See {@link isResolvedRoleMembers}. */
  resolved: boolean;
};

/**
 * Whether the viewer actually resolved the roles of a vault. It answers with zero addresses instead
 * of reverting when it cannot reach the vault through its `VaultHub` connection record — for a
 * disconnected vault, or transiently while reading a block where the connection is not visible.
 * Such a response carries no roles and must never be persisted: it would replace the last known good
 * members and cut the vault owner off from their own vault.
 */
export const isResolvedRoleMembers = (owner: string, nodeOperator: string): boolean =>
  owner !== zeroAddress && nodeOperator !== zeroAddress;

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

  async vaultsCount(overrides?: Overrides): Promise<number> {
    const vaultsCount = await this.contract.vaultsCount(overrides);
    return Number(vaultsCount);
  }

  async getVaultData(vault: string, overrides?: Overrides): Promise<VaultData> {
    const raw = await this.contract.vaultData(vault, overrides);
    return VaultViewerContractService.transformVaultData(raw);
  }

  async getVaultsDataBatch(from: number, to: number, overrides?: Overrides): Promise<VaultData[]> {
    const rawVaultsData = await this.contract.vaultsDataBatch(from, to, overrides);
    return rawVaultsData.map(VaultViewerContractService.transformVaultData);
  }

  async getRoleMembers(vaultAddress: string, roles: string[], overrides?: Overrides): Promise<RoleMembers> {
    const [, owner, nodeOperator, membersRaw]: RawVaultRoleMembers = await this.contract.roleMembers(
      vaultAddress,
      roles,
      overrides,
    );

    return VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw);
  }

  async getRoleMembersWithRetry(vaultAddress: string, roles: string[], overrides?: Overrides): Promise<RoleMembers> {
    const result = await rpcCallWithRetry(
      async () => {
        const [, owner, nodeOperator, membersRaw]: RawVaultRoleMembers = await this.contract.roleMembers(
          vaultAddress,
          roles,
          overrides,
        );
        return { owner, nodeOperator, membersRaw };
      },
      {
        callName: 'getRoleMembers',
        logger: this.logger,
        acceptResult: ({ owner, nodeOperator }) => isResolvedRoleMembers(owner, nodeOperator),
      },
    );

    const { owner, nodeOperator, membersRaw } = result;

    return VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw);
  }

  /**
   * Unlike {@link getRoleMembersWithRetry}, a batch cannot be retried per vault, so unresolved
   * entries are flagged rather than filtered out or retried: the caller has to know a vault was
   * skipped instead of silently seeing a shorter list.
   */
  async getRoleMembersBatch(
    vaultAddresses: string[],
    roles: string[],
    overrides?: Overrides,
  ): Promise<VaultRoleMembers[]> {
    const raw: RawVaultRoleMembers[] = await this.contract.roleMembersBatch(vaultAddresses, roles, overrides);

    return raw.map(([vault, owner, nodeOperator, membersRaw]) => ({
      vault,
      roleMembersMap: VaultViewerContractService.transformRoleMembersMap(owner, nodeOperator, membersRaw),
      resolved: isResolvedRoleMembers(owner, nodeOperator),
    }));
  }

  private static transformVaultData(vaultData: any): VaultData {
    return {
      vault: vaultData.vaultAddress,
      connectionOwner: vaultData.connection.owner,
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
      accruedFee: vaultData.accruedFee.toBigInt(),
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

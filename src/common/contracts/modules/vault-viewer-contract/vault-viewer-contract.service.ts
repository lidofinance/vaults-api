import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import {
  STAKING_VAULT_OWNER_ROLE,
  STAKING_VAULT_NODE_OPERATOR_ROLE,
  STAKING_VAULT_DEPOSITOR_ROLE,
  ROLE_KEYS,
} from 'vault-member/vault-member.constants';
import { VaultViewerAbi } from '../../abi/VaultViewer';

export type Overrides = { blockTag?: number | string };

export type VaultData = {
  vault: string;
  totalValue: bigint;
  forcedRebalanceThreshold: number;
  liabilityShares: bigint;
  stEthLiability: bigint;
  lidoTreasuryFee: bigint;
  nodeOperatorFee: bigint;
  isOwnerDashboard: boolean;
};

export type RoleMembers = Record<string, string[]>;

export type RawVaultRoleMembers = [
  string, // owner
  string, // nodeOperator
  string, // depositor
  string[][], // members
];

export type RawVaultRoleMembersWithVault = [
  string, // vault
  string, // owner
  string, // nodeOperator
  string, // depositor
  string[][], // members
];

@Injectable()
export class VaultViewerContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
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

  async getVaultsDataBound(from: number, to: number, overrides?: Overrides): Promise<VaultData[]> {
    const rawData = await this.contract.getVaultsDataBound(from, to, overrides);
    return rawData.map(VaultViewerContractService.transformVaultData);
  }

  async getRoleMembers(vaultAddress: string, roles: string[], overrides?: Overrides): Promise<RoleMembers> {
    const [owner, nodeOperator, depositor, membersRaw]: RawVaultRoleMembers = await this.contract.getRoleMembers(
      vaultAddress,
      roles,
      overrides,
    );

    const roleMembersMap: RoleMembers = {
      // Although `owner`, `nodeOperator`, and `depositor` are always single addresses,
      // we wrap them in arrays for consistency/general usage with other roles.
      [STAKING_VAULT_OWNER_ROLE]: [owner],
      [STAKING_VAULT_NODE_OPERATOR_ROLE]: [nodeOperator],
      [STAKING_VAULT_DEPOSITOR_ROLE]: [depositor],
    };

    for (let i = 0; i < ROLE_KEYS.length; i++) {
      const members = membersRaw[i] || [];
      if (members.length > 0) {
        roleMembersMap[ROLE_KEYS[i]] = members;
      }
    }

    return roleMembersMap;
  }

  async getRoleMembersBatch(
    vaultAddresses: string[],
    roles: string[],
    overrides?: Overrides,
  ): Promise<Array<{ vault: string; roleMembersMap: RoleMembers }>> {
    const raw: RawVaultRoleMembersWithVault[] = await this.contract.getRoleMembersBatch(
      vaultAddresses,
      roles,
      overrides,
    );

    return raw.map(([vault, owner, nodeOperator, depositor, membersRaw]) => {
      const roleMembersMap: RoleMembers = {
        // Although `owner`, `nodeOperator`, and `depositor` are always single addresses,
        // we wrap them in arrays for consistency/general usage with other roles.
        [STAKING_VAULT_OWNER_ROLE]: [owner],
        [STAKING_VAULT_NODE_OPERATOR_ROLE]: [nodeOperator],
        [STAKING_VAULT_DEPOSITOR_ROLE]: [depositor],
      };

      for (let i = 0; i < ROLE_KEYS.length; i++) {
        const members = membersRaw[i] || [];
        if (members.length > 0) {
          roleMembersMap[ROLE_KEYS[i]] = members;
        }
      }

      return { vault, roleMembersMap };
    });
  }

  private static transformVaultData(vaultData: any): VaultData {
    return {
      vault: vaultData.socket.vault,
      totalValue: vaultData.totalValue.toBigInt(),
      forcedRebalanceThreshold: vaultData.socket.forcedRebalanceThresholdBP,
      liabilityShares: vaultData.socket.liabilityShares.toBigInt(),
      stEthLiability: vaultData.stEthLiability.toBigInt(),
      lidoTreasuryFee: vaultData.socket.treasuryFeeBP,
      nodeOperatorFee: vaultData.nodeOperatorFee.toBigInt(),
      isOwnerDashboard: vaultData.isOwnerDashboard,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { ROLE_KEYS } from 'vault-member/vault-member.constants';
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

  async getVaultsDataBatch(from: number, to: number, overrides?: Overrides): Promise<VaultData[]> {
    const rawData = await this.contract.getVaultsDataBatch(from, to, overrides);
    return rawData.map(this.transformVaultData);
  }

  async getVaultDataByAddress(vault: string, overrides?: Overrides): Promise<VaultData> {
    const raw = await this.contract.getVaultsDataByAddress(vault, overrides);
    return this.transformVaultData(raw);
  }

  async getRoleMembers(vaultAddress: string, roles: string[]): Promise<RoleMembers> {
    const roleMembersRaw: string[][] = await this.contract.getRoleMembers(vaultAddress, roles);

    const roleMembersMap: RoleMembers = {};

    for (let i = 0; i < ROLE_KEYS.length; i++) {
      const _members = roleMembersRaw[i] || [];
      if (_members.length > 0) {
        roleMembersMap[ROLE_KEYS[i]] = _members;
      }
    }

    return roleMembersMap;
  }

  private transformVaultData(vaultData: any): VaultData {
    return {
      vault: vaultData.vault,
      totalValue: vaultData.totalValue.toBigInt(),
      // vaultData.forcedRebalanceThreshold is safe here, because it can't be more than 10_000
      forcedRebalanceThreshold: vaultData.forcedRebalanceThreshold.toNumber(),
      liabilityShares: vaultData.liabilityShares.toBigInt(),
      stEthLiability: vaultData.stEthLiability.toBigInt(),
      lidoTreasuryFee: vaultData.lidoTreasuryFee.toBigInt(),
      nodeOperatorFee: vaultData.nodeOperatorFee.toBigInt(),
      isOwnerDashboard: vaultData.isOwnerDashboard,
    };
  }
}

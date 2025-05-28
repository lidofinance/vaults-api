import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerAbi } from '../../abi/VaultViewer';

type VaultData = {
  vault: string;
  totalValue: bigint;
  forcedRebalanceThreshold: number;
  liabilityShares: bigint;
  stEthLiability: bigint;
  lidoTreasuryFee: bigint;
  nodeOperatorFee: bigint;
  isOwnerDashboard: boolean;
};

@Injectable()
export class VaultViewerContractService {
  private readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
    if (!address) throw new Error('VaultViewer contract address is not defined');
    this.contract = new Contract(address, VaultViewerAbi, provider);
  }

  async getVaultsConnectedBound(from: number, to: number): Promise<{ addresses: string[]; leftoverVaults: number }> {
    const [addresses, leftoverVaults] = await this.contract.vaultsConnectedBound(from, to);
    // leftoverVaults.toNumber() is safe here!
    return { addresses, leftoverVaults: leftoverVaults.toNumber() };
  }

  async getVaultsDataBatch(from: number, to: number): Promise<VaultData[]> {
    const res = await this.contract.getVaultsDataBatch(from, to);

    return res.map((vaultData: any) => ({
      vault: vaultData.vault,
      totalValue: res[0].totalValue.toBigInt(),
      // vaultData.forcedRebalanceThreshold is safe here, because it can't be more than 10_000
      forcedRebalanceThreshold: vaultData.forcedRebalanceThreshold.toNumber(),
      liabilityShares: vaultData.liabilityShares.toBigInt(),
      stEthLiability: vaultData.stEthLiability.toBigInt(),
      lidoTreasuryFee: vaultData.lidoTreasuryFee.toBigInt(),
      nodeOperatorFee: vaultData.nodeOperatorFee.toBigInt(),
      isOwnerDashboard: vaultData.isOwnerDashboard,
    }));
  }
}

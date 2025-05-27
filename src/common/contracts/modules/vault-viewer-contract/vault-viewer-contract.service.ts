import { Injectable } from '@nestjs/common';
import { BigNumber, Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerAbi } from '../../abi/VaultViewer';

type VaultData = {
  vault: string;
  totalValue: bigint;
  forcedRebalanceThreshold: bigint;
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

  async getVaultsConnectedBound(from: number, to: number): Promise<{ addresses: string[]; total: bigint }> {
    const [addresses, total] = await this.contract.vaultsConnectedBound(from, to);
    return { addresses, total };
  }

  async getVaultsDataBatch(from: number, to: number): Promise<VaultData[]> {
    const res = await this.contract.getVaultsDataBatch(from, to);
    return res.map((vaultData: any) => ({
      vault: vaultData.vault,
      totalValue: BigNumber.from(vaultData.totalValue).toBigInt(),
      forcedRebalanceThreshold: BigNumber.from(vaultData.forcedRebalanceThreshold).toBigInt(),
      liabilityShares: BigNumber.from(vaultData.liabilityShares).toBigInt(),
      stEthLiability: BigNumber.from(vaultData.stEthLiability).toBigInt(),
      lidoTreasuryFee: BigNumber.from(vaultData.lidoTreasuryFee).toBigInt(),
      nodeOperatorFee: BigNumber.from(vaultData.nodeOperatorFee).toBigInt(),
      isOwnerDashboard: vaultData.isOwnerDashboard,
    }));
  }
}

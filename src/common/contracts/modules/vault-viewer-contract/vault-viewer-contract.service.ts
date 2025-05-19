import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerAbi } from '../../abi/VaultViewer';

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
}

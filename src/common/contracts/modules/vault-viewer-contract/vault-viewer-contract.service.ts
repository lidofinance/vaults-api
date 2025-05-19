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

  async getVaultHub(): Promise<string> {
    const address = await this.contract.vaultHub();
    return address;
  }
}

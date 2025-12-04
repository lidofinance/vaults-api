import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { VaultHubAbi } from '../../abi/VaultHub';

@Injectable()
export class VaultHubContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
    if (!address) throw new Error('VaultHub contract address is not defined');
    this.contract = new Contract(address, VaultHubAbi, provider);
  }
}

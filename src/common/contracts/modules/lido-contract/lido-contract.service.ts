import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { LidoAbi } from '../../abi/Lido';

@Injectable()
export class LidoContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
    if (!address) throw new Error('Lido contract address is not defined');
    this.contract = new Contract(address, LidoAbi, provider);
  }
}

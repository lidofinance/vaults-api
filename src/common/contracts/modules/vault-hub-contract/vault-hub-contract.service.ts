import { Injectable } from '@nestjs/common';
import { Contract } from 'ethers';

import { ExecutionProvider } from 'common/execution-provider';
import { VaultHubAbi } from '../../abi/VaultHub';

export type Overrides = { blockTag?: number | string };

@Injectable()
export class VaultHubContractService {
  public readonly contract: Contract;

  constructor(provider: ExecutionProvider, address: string) {
    if (!address) throw new Error('VaultHub contract address is not defined');
    this.contract = new Contract(address, VaultHubAbi, provider);
  }

  async getVaultOwner(vault: string, overrides?: Overrides): Promise<string> {
    const result = await this.contract.callStatic.vaultConnection(...(overrides ? [vault, overrides] : [vault]));

    return result.owner;
  }

  async getVaultConnection(vault: string, overrides?: Overrides): Promise<any> {
    return this.contract.callStatic.vaultConnection(...(overrides ? [[vault], overrides] : [[vault]]));
  }
}

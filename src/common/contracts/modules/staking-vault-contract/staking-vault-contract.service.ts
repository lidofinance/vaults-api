import { Contract } from 'ethers';

import { LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { StakingVaultAbi } from 'common/contracts/abi/StakingVault';

export type Overrides = { blockTag?: number | string };

export class StakingVaultContractService {
  public readonly contract: Contract;

  constructor(
    private readonly provider: ExecutionProvider,
    private readonly stakingVaultAddress: string,
    private readonly logger: LoggerService,
  ) {
    if (!stakingVaultAddress) {
      throw new Error('StakingVault contract address is not defined');
    }

    this.contract = new Contract(stakingVaultAddress, StakingVaultAbi, provider);
  }

  get address(): string {
    return this.stakingVaultAddress;
  }

  async getOwner(overrides?: Overrides): Promise<string> {
    return String(await this.contract.callStatic.owner(...(overrides ? [overrides] : [])));
  }
}

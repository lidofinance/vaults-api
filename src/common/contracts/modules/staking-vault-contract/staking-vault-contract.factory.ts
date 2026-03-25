import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ExecutionProvider } from 'common/execution-provider';
import { StakingVaultContractService } from './staking-vault-contract.service';

@Injectable()
export class StakingVaultContractFactory {
  private readonly services = new Map<string, StakingVaultContractService>();

  constructor(
    private readonly provider: ExecutionProvider,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
  ) {}

  get(stakingVaultAddress: string): StakingVaultContractService {
    if (!stakingVaultAddress) {
      throw new Error('StakingVault address is not defined');
    }

    const key = stakingVaultAddress.toLowerCase();

    const existing = this.services.get(key);
    if (existing) return existing;

    const created = new StakingVaultContractService(
      this.provider,
      stakingVaultAddress,
      this.logger,
    );

    this.services.set(key, created);
    return created;
  }
}

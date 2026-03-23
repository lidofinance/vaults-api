import { Module } from '@nestjs/common';
import { StakingVaultContractFactory } from './staking-vault-contract.factory';

@Module({
  providers: [StakingVaultContractFactory],
  exports: [StakingVaultContractFactory],
})
export class StakingVaultContractModule {}

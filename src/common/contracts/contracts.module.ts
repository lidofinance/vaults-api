import { LidoLocatorContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';

import { ConfigService } from '../config';
import { DashboardContractModule } from './modules/dashboard-contract';
import { VaultHubContractModule } from './modules/vault-hub-contract';
import { LidoContractModule } from './modules/lido-contract';
import { LazyOracleContractModule } from './modules/lazy-oracle-contract';
import { VaultViewerContractModule } from './modules/vault-viewer-contract';
import { StakingVaultContractModule } from './modules/staking-vault-contract';

@Global()
@Module({
  imports: [
    ...[LidoLocatorContractModule].map((module) =>
      module.forRootAsync({
        async useFactory(provider: ExecutionProvider, config: ConfigService) {
          const addressMap = config.getCustomConfigContractsAddressMap();
          const address = addressMap ? addressMap.get(module.contractToken) : undefined;
          return { provider, address };
        },
        inject: [ExecutionProvider, ConfigService],
      }),
    ),
    DashboardContractModule,
    VaultHubContractModule,
    VaultViewerContractModule,
    LidoContractModule,
    LazyOracleContractModule,
    StakingVaultContractModule,
  ],
  exports: [
    DashboardContractModule,
    LidoLocatorContractModule,
    VaultHubContractModule,
    VaultViewerContractModule,
    LidoContractModule,
    LazyOracleContractModule,
    StakingVaultContractModule,
  ],
})
export class ContractsModule {}

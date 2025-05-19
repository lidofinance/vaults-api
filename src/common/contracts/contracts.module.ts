import { LidoContractModule, LidoLocatorContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { ConfigService } from '../config';
import { VaultHubContractModule } from './modules/vault-hub-contract';
import { VaultViewerContractModule } from './modules/vault-viewer-contract';

@Global()
@Module({
  imports: [
    ...[LidoContractModule, LidoLocatorContractModule].map((module) =>
      module.forRootAsync({
        async useFactory(provider: ExecutionProvider, config: ConfigService) {
          const addressMap = await config.getCustomConfigContractsAddressMap();
          const address = addressMap ? addressMap.get(module.contractToken) : undefined;
          return { provider, address };
        },
        inject: [ExecutionProvider, ConfigService],
      }),
    ),
    VaultHubContractModule,
    VaultViewerContractModule,
  ],
  exports: [VaultHubContractModule, VaultViewerContractModule],
})
export class ContractsModule {}

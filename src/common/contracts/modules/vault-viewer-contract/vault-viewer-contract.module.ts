import { Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService } from './vault-viewer-contract.service';
import { ConfigService } from '../../../config';
import { VAULT_VIEWER_CONTRACT } from '../../contracts.constants';

@Module({
  providers: [
    {
      provide: VaultViewerContractService,
      useFactory: async (provider: ExecutionProvider, config: ConfigService, logger: LoggerService) => {
        const addressMap = config.getCustomConfigContractsAddressMap();
        const vaultViewerAddress = addressMap ? addressMap.get(VAULT_VIEWER_CONTRACT) : undefined;
        return new VaultViewerContractService(provider, vaultViewerAddress, logger);
      },
      inject: [ExecutionProvider, ConfigService, LOGGER_PROVIDER],
    },
  ],
  exports: [VaultViewerContractService],
})
export class VaultViewerContractModule {}

import { Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { VaultViewerContractService } from './vault-viewer-contract.service';
import { ConfigService } from '../../../config';
import { VAULT_VIEWER_CONTRACT } from '../../contracts.constants';

@Module({
  providers: [
    {
      provide: VaultViewerContractService,
      useFactory: async (provider: ExecutionProvider, config: ConfigService) => {
        const addressMap = await config.getCustomConfigContractsAddressMap();
        const vaultViewerAddress = addressMap ? addressMap.get(VAULT_VIEWER_CONTRACT) : undefined;
        return new VaultViewerContractService(provider, vaultViewerAddress);
      },
      inject: [ExecutionProvider, ConfigService],
    },
  ],
  exports: [VaultViewerContractService],
})
export class VaultViewerContractModule {}

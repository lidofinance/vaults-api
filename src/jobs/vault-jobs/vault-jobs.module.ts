import { Module } from '@nestjs/common';

import { VaultViewerContractModule } from 'common/contracts/modules/vault-viewer-contract';
import { VaultsModule } from 'vault';

import { VaultJobsService } from './vault-jobs.service';

@Module({
  imports: [VaultsModule, VaultViewerContractModule],
  providers: [VaultJobsService],
  exports: [VaultJobsService],
})
export class VaultJobsModule {}

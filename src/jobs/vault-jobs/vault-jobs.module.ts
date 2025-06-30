import { Module } from '@nestjs/common';

import { VaultViewerContractModule } from 'common/contracts/modules/vault-viewer-contract';
import { VaultModule } from 'vault';
import { LsvModule } from 'lsv';

import { VaultJobsService } from './vault-jobs.service';

@Module({
  imports: [VaultModule, VaultViewerContractModule, LsvModule],
  providers: [VaultJobsService],
  exports: [VaultJobsService],
})
export class VaultJobsModule {}

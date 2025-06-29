import { Module } from '@nestjs/common';

import { VaultsModule } from 'vault';
import { VaultViewerContractModule } from 'common/contracts/modules/vault-viewer-contract';

import { VaultMemberJobsService } from './vault-member-jobs.service';

@Module({
  imports: [VaultsModule, VaultViewerContractModule],
  providers: [VaultMemberJobsService],
  exports: [VaultMemberJobsService],
})
export class VaultMemberJobsModule {}

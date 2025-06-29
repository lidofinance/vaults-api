import { Module } from '@nestjs/common';

import { VaultViewerContractModule } from 'common/contracts/modules/vault-viewer-contract';
import { VaultsModule } from 'vault';

import { VaultMemberJobsService } from '../vault-member-jobs';
import { ReportJobsModule } from '../report-jobs';

import { VaultJobsService } from './vault-jobs.service';

@Module({
  imports: [VaultsModule, VaultViewerContractModule, ReportJobsModule],
  providers: [VaultJobsService, VaultMemberJobsService],
  exports: [VaultJobsService],
})
export class VaultJobsModule {}

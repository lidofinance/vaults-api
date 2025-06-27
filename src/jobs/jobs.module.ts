import { Module } from '@nestjs/common';

import { VaultJobsModule } from './vault-jobs';
import { VaultMemberJobsModule } from './vault-member-jobs';
import { ReportJobsModule } from './report-jobs';
import { JobsService } from './jobs.service';

@Module({
  imports: [VaultJobsModule, VaultMemberJobsModule, ReportJobsModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

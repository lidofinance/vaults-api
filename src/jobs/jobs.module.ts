import { Module } from '@nestjs/common';

import { VaultJobsModule } from './vault-jobs';
import { VaultMemberJobsModule } from './vault-member-jobs';
import { ReportJobsModule } from './report-jobs';
import { ReportStatisticJobsModule } from './report-statistic-jobs';
import { JobsService } from './jobs.service';

@Module({
  imports: [VaultJobsModule, VaultMemberJobsModule, ReportJobsModule, ReportStatisticJobsModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

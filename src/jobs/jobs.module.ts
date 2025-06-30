import { Module } from '@nestjs/common';

import { VaultJobsModule } from './vault-jobs';
import { ReportJobsModule } from './report-jobs';
import { JobsService } from './jobs.service';

@Module({
  imports: [VaultJobsModule, ReportJobsModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

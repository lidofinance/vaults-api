import { Module } from '@nestjs/common';

import { ReportModule } from 'report';
import { VaultModule } from 'vault';
import { ReportJobsService } from './report-jobs.service';

@Module({
  imports: [ReportModule, VaultModule],
  providers: [ReportJobsService],
  exports: [ReportJobsService],
})
export class ReportJobsModule {}

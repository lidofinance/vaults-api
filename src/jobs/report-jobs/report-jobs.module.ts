import { Module } from '@nestjs/common';

import { ContractsModule } from 'common/contracts';
import { ReportModule } from 'report';
import { VaultsModule } from 'vault';

import { ReportJobsService } from './report-jobs.service';

@Module({
  imports: [ContractsModule, ReportModule, VaultsModule],
  providers: [ReportJobsService],
  exports: [ReportJobsService],
})
export class ReportJobsModule {}

import { Module } from '@nestjs/common';

import { ReportModule } from 'report';
import { ContractsModule } from 'common/contracts';

import { ReportStatisticJobsService } from './report-statistic-jobs.service';

@Module({
  imports: [ReportModule, ContractsModule],
  providers: [ReportStatisticJobsService],
  exports: [ReportStatisticJobsService],
})
export class ReportStatisticJobsModule {}

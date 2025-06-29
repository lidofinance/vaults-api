import { Module } from '@nestjs/common';

import { ContractsModule } from 'common/contracts';
import { ReportModule } from 'report';
import { VaultsModule } from 'vault';

import { ReportStatisticJobsService } from './report-statistic-jobs.service';

@Module({
  imports: [ContractsModule, ReportModule, VaultsModule],
  providers: [ReportStatisticJobsService],
  exports: [ReportStatisticJobsService],
})
export class ReportStatisticJobsModule {}

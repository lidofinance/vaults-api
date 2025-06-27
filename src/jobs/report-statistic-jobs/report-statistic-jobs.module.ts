import { Module } from '@nestjs/common';

import { ReportModule } from 'report';
import { ContractsModule } from 'common/contracts';
import { VaultsStateHourlyModule } from 'vaults-state-hourly';

import { ReportStatisticJobsService } from './report-statistic-jobs.service';

@Module({
  imports: [ReportModule, ContractsModule, VaultsStateHourlyModule],
  providers: [ReportStatisticJobsService],
  exports: [ReportStatisticJobsService],
})
export class ReportStatisticJobsModule {}

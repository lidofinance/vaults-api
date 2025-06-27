import { Module } from '@nestjs/common';

import { ReportModule } from 'report';
import { ContractsModule } from 'common/contracts';
import { VaultsStateHourlyModule } from 'vaults-state-hourly';
import { VaultsModule } from 'vault';

import { ReportStatisticJobsService } from './report-statistic-jobs.service';

@Module({
  imports: [ReportModule, ContractsModule, VaultsModule, VaultsStateHourlyModule],
  providers: [ReportStatisticJobsService],
  exports: [ReportStatisticJobsService],
})
export class ReportStatisticJobsModule {}

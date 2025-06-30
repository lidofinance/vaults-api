import { Module } from '@nestjs/common';

import { ContractsModule } from 'common/contracts';
import { ReportModule } from 'report';
import { VaultsModule } from 'vault';
import { LsvModule } from 'lsv';

import { VaultJobsModule } from '../vault-jobs';
import { ReportJobsService } from './report-jobs.service';

@Module({
  imports: [ContractsModule, ReportModule, VaultsModule, LsvModule, VaultJobsModule],
  providers: [ReportJobsService],
  exports: [ReportJobsService],
})
export class ReportJobsModule {}

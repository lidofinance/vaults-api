import { Module } from '@nestjs/common';

import { VaultHubContractModule } from 'common/contracts/modules/vault-hub-contract';
import { ReportModule } from 'report';

import { ReportJobsService } from './report-jobs.service';

@Module({
  imports: [VaultHubContractModule, ReportModule],
  providers: [ReportJobsService],
  exports: [ReportJobsService],
})
export class ReportJobsModule {}

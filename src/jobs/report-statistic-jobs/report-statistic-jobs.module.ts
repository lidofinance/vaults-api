import { Module } from '@nestjs/common';

// TODO: remove?
import { VaultHubContractModule } from 'common/contracts/modules/vault-hub-contract';
import { ReportModule } from 'report';

import { ReportStatisticJobsService } from './report-statistic-jobs.service';

@Module({
  imports: [VaultHubContractModule, ReportModule],
  providers: [ReportStatisticJobsService],
  exports: [ReportStatisticJobsService],
})
export class ReportStatisticJobsModule {}

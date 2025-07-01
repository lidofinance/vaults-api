import { Module } from '@nestjs/common';

import { VaultDbModule } from 'db/vault-db';
import { ReportDbModule } from 'db/report-db';
import { LsvModule } from 'lsv';

import { ReportService } from './report.service';

@Module({
  imports: [VaultDbModule, ReportDbModule, LsvModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}

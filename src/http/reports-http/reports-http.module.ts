import { Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { LsvService } from 'lsv/lsv.service';
import { ReportsMerkleService } from 'report/reports-merkle.service';

import { ReportsHttpController } from './reports-http.controller';

@Module({
  imports: [LoggerModule],
  controllers: [ReportsHttpController],
  providers: [LsvService, ReportsMerkleService],
})
export class ReportsHttpModule {}

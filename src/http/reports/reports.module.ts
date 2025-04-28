import { Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { LsvService } from 'lsv/lsv.service';

import { ReportsController } from './reports.controller';

@Module({
  imports: [LoggerModule],
  controllers: [ReportsController],
  providers: [LsvService],
})
export class ReportsModule {}

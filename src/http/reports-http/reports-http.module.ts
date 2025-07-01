import { Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { LsvService } from 'lsv/lsv.service';

import { ReportsHttpController } from './reports-http.controller';

@Module({
  imports: [LoggerModule],
  controllers: [ReportsHttpController],
  providers: [LsvService],
})
export class ReportsHttpModule {}

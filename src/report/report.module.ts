import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportService } from './report.service';
import { ReportEntity } from './report.entity';
import { ReportLeafEntity } from './report-leaf.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReportEntity, ReportLeafEntity])],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}

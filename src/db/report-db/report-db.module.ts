import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportDbService } from './report-db.service';
import { ReportEntity, ReportLeafEntity } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([ReportEntity, ReportLeafEntity])],
  providers: [ReportDbService],
  exports: [ReportDbService],
})
export class ReportDbModule {}

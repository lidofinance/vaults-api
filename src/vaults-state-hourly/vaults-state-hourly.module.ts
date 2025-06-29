import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsStateHourlyService } from './vaults-state-hourly.service';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';

import { VaultReportStatsEntity } from './vault-report-stats.entity';
import { VaultReportStatsService } from './vault-report-stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([VaultsStateHourlyEntity, VaultReportStatsEntity])],
  providers: [VaultsStateHourlyService, VaultReportStatsService],
  exports: [VaultsStateHourlyService, VaultReportStatsService],
})
export class VaultsStateHourlyModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsService } from './vault.service';
import { VaultEntity, VaultMemberEntity, VaultsStateHourlyEntity, VaultReportStatsEntity } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaultEntity, VaultMemberEntity, VaultsStateHourlyEntity, VaultReportStatsEntity]),
  ],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}

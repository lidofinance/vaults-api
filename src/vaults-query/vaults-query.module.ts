import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsStateHourlyEntity } from 'vaults-state-hourly/vaults-state-hourly.entity';
import { VaultsQueryService } from './vaults-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([VaultsStateHourlyEntity])],
  providers: [VaultsQueryService],
  exports: [VaultsQueryService],
})
export class VaultsQueryModule {}

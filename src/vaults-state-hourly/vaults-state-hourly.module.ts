import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsStateHourlyService } from './vaults-state-hourly.service';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VaultsStateHourlyEntity])],
  providers: [VaultsStateHourlyService],
  exports: [VaultsStateHourlyService],
})
export class VaultsStateHourlyModule {}

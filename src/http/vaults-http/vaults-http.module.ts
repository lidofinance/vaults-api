import { Module } from '@nestjs/common';
import { VaultsHttpController } from './vaults-http.controller';
import { VaultsModule } from '../../vault';
import { VaultsStateHourlyModule } from '../../vaults-state-hourly';

@Module({
  imports: [VaultsModule, VaultsStateHourlyModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

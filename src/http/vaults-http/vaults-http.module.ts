import { Module } from '@nestjs/common';
import { VaultsHttpController } from './vaults-http.controller';
import { VaultsModule } from '../../vault';
import { VaultsStateHourlyModule } from '../../vaults-state-hourly';
import { VaultMembersModule } from '../../vault-member';

@Module({
  imports: [VaultsModule, VaultsStateHourlyModule, VaultMembersModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

import { Module } from '@nestjs/common';

import { VaultsModule } from 'vault';
import { VaultsStateHourlyModule } from 'vaults-state-hourly';
import { VaultMembersModule } from 'vault-member';
import { VaultsQueryModule } from 'vaults-query';
import { VaultsHttpController } from './vaults-http.controller';

@Module({
  imports: [VaultsModule, VaultsStateHourlyModule, VaultMembersModule, VaultsQueryModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

import { Module } from '@nestjs/common';

import { VaultDbModule } from 'db/vault-db';
import { VaultsHttpController } from './vaults-http.controller';

@Module({
  imports: [VaultDbModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

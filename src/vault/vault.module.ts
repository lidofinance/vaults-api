import { Module } from '@nestjs/common';

import { VaultDbModule } from 'db/vault-db';
import { LsvModule } from 'lsv';
import { ContractsModule } from 'common/contracts';

import { VaultService } from './vault.service';

@Module({
  imports: [ContractsModule, VaultDbModule, LsvModule],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}

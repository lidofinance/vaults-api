import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultEntity } from 'vault/vault.entity';
import { VaultsService } from 'vault/vault.service';

import { JobsService } from './jobs.service';
import { VaultViewerContractModule } from '../common/contracts/modules/vault-viewer-contract';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaultEntity]), // ← вот это обязательно
    VaultViewerContractModule,
  ],
  providers: [JobsService, VaultsService],
  exports: [JobsService],
})
export class JobsModule {}

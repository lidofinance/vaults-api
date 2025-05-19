import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultEntity } from 'vault/vault.entity';
import { VaultsService } from 'vault/vault.service';

import { VaultJobsService } from './vault-jobs.service';
import { VaultViewerContractModule } from '../../common/contracts/modules/vault-viewer-contract';

@Module({
  imports: [TypeOrmModule.forFeature([VaultEntity]), VaultViewerContractModule],
  providers: [VaultJobsService, VaultsService],
  exports: [VaultJobsService],
})
export class VaultJobsModule {}

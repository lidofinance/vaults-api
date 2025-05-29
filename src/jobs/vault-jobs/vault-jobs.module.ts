import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultEntity } from 'vault/vault.entity';
import { VaultsService } from 'vault/vault.service';
import { VaultsStateHourlyService } from 'vaults-state-hourly/vaults-state-hourly.service';
import { VaultsStateHourlyEntity } from 'vaults-state-hourly/vaults-state-hourly.entity';

import { VaultJobsService } from './vault-jobs.service';
import { VaultViewerContractModule } from '../../common/contracts/modules/vault-viewer-contract';

@Module({
  imports: [TypeOrmModule.forFeature([VaultEntity, VaultsStateHourlyEntity]), VaultViewerContractModule],
  providers: [VaultJobsService, VaultsService, VaultsStateHourlyService],
  exports: [VaultJobsService, VaultsStateHourlyService],
})
export class VaultJobsModule {}

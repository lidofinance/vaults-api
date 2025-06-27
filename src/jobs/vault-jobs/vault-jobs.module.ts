import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultViewerContractModule } from 'common/contracts/modules/vault-viewer-contract';
import { VaultEntity } from 'vault/vault.entity';
import { VaultsService } from 'vault/vault.service';
import { VaultsStateHourlyService } from 'vaults-state-hourly/vaults-state-hourly.service';
import { VaultsStateHourlyEntity } from 'vaults-state-hourly/vaults-state-hourly.entity';

import { VaultsMemberService } from 'vault-member/vault-member.service';
import { VaultMemberEntity } from 'vault-member/vault-member.entity';

import { VaultMemberJobsService } from '../vault-member-jobs';
import { ReportJobsModule } from '../report-jobs';

import { VaultJobsService } from './vault-jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaultEntity, VaultsStateHourlyEntity, VaultMemberEntity]),
    VaultViewerContractModule,
    ReportJobsModule,
  ],
  providers: [VaultJobsService, VaultMemberJobsService, VaultsService, VaultsStateHourlyService, VaultsMemberService],
  exports: [VaultJobsService, VaultsStateHourlyService],
})
export class VaultJobsModule {}

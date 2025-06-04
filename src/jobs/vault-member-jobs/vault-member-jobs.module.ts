import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultEntity } from 'vault/vault.entity';
import { VaultsService } from 'vault/vault.service';
import { VaultMemberEntity } from 'vault-member/vault-member.entity';
import { VaultsMemberService } from 'vault-member/vault-member.service';

import { VaultMemberJobsService } from './vault-member-jobs.service';
import { VaultViewerContractModule } from '../../common/contracts/modules/vault-viewer-contract';
import { VaultMembersModule } from '../../vault-member';

@Module({
  imports: [VaultMembersModule, TypeOrmModule.forFeature([VaultEntity, VaultMemberEntity]), VaultViewerContractModule],
  providers: [VaultMemberJobsService, VaultsService, VaultsMemberService],
  exports: [VaultMemberJobsService],
})
export class VaultMemberJobsModule {}

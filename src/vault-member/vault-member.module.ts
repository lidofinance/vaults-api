import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsMemberService } from './vault-member.service';
import { VaultMemberEntity } from './vault-member.entity';
import { VaultEntity } from '../vault';

@Module({
  imports: [TypeOrmModule.forFeature([VaultEntity, VaultMemberEntity])],
  providers: [VaultsMemberService],
  exports: [VaultsMemberService],
})
export class VaultMembersModule {}

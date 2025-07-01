import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultDbService } from './vault-db.service';
import { VaultEntity, VaultMemberEntity, VaultStateEntity, VaultReportStatEntity } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([VaultEntity, VaultMemberEntity, VaultStateEntity, VaultReportStatEntity])],
  providers: [VaultDbService],
  exports: [VaultDbService],
})
export class VaultDbModule {}

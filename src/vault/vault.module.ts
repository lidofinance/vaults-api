import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VaultsService } from './vault.service';
import { VaultEntity } from './vault.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VaultEntity])],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}

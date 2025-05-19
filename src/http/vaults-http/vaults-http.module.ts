import { Module } from '@nestjs/common';
import { VaultsHttpController } from './vaults-http.controller';
import { VaultsModule } from '../../vault/vault.module';

@Module({
  imports: [VaultsModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

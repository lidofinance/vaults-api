import { Module } from '@nestjs/common';

import { VaultsModule } from 'vault';
import { VaultsHttpController } from './vaults-http.controller';

@Module({
  imports: [VaultsModule],
  controllers: [VaultsHttpController],
})
export class VaultsHttpModule {}

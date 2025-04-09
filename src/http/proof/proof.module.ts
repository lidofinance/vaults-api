import { Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { LsvService } from 'lsv/lsv.service';

import { ProofController } from './proof.controller';

@Module({
  imports: [LoggerModule],
  controllers: [ProofController],
  providers: [LsvService],
})
export class ProofModule {}

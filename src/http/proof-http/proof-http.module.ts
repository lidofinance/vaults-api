import { Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { LsvService } from 'lsv/lsv.service';

// Uncomment when needed
// import { ProofController } from './proof.controller';

@Module({
  imports: [LoggerModule],
  // Uncomment when needed
  // controllers: [ProofController],
  providers: [LsvService],
})
export class ProofHttpModule {}

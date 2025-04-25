import { Module } from '@nestjs/common';
import { LsvService } from './lsv.service';

@Module({
  providers: [LsvService],
  exports: [LsvService],
})
export class LsvModule {}

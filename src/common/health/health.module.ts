import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { LiveController } from './live.controller';

@Module({
  providers: [],
  controllers: [HealthController, LiveController],
  imports: [TerminusModule],
})
export class HealthModule {}

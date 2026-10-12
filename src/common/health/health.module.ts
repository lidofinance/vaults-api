import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { LiveController } from './live.controller';
import { ReadinessController } from './readiness.controller';

@Module({
  providers: [],
  controllers: [HealthController, LiveController, ReadinessController],
  imports: [TerminusModule],
})
export class HealthModule {}

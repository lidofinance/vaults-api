import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { SkipCache } from 'common/decorators';
import { READYZ_URL, MAX_MEMORY_HEAP } from './health.constants';

@Controller(READYZ_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class ReadinessController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.memory.checkHeap('memoryHeap', MAX_MEMORY_HEAP),
      async () => this.database.pingCheck('database', { timeout: 1000 }),
    ]);
  }
}

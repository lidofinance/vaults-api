import { Reflector } from '@nestjs/core';

import { SKIP_CACHE_KEY } from 'common/decorators';

import { ReadinessController } from './readiness.controller';

describe('ReadinessController', () => {
  const memory = { checkHeap: jest.fn() };
  const database = { pingCheck: jest.fn() };
  const health = { check: jest.fn((checks) => checks) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opts out of the response cache', () => {
    expect(Reflect.getMetadata(SKIP_CACHE_KEY, ReadinessController)).toBe(true);
  });

  it('/readyz checks memory and PostgreSQL', async () => {
    const controller = new ReadinessController(health as never, memory as never, database as never);
    controller.check();
    const checks = health.check.mock.calls[0][0] as Array<() => Promise<unknown>>;

    expect(checks).toHaveLength(2);
    await Promise.all(checks.map((check) => check()));

    expect(memory.checkHeap).toHaveBeenCalled();
    expect(database.pingCheck).toHaveBeenCalledWith('database', { timeout: 1000 });
  });
});

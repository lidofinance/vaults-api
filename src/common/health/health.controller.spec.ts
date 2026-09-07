import { Reflector } from '@nestjs/core';

import { SKIP_CACHE_KEY } from 'common/decorators';

import { HealthController } from './health.controller';

// ---------------------------------------------------------------------------
// HealthController cache opt-out
//
// The response cache interceptor is application-wide, so without this opt-out a cached
// 200 could answer a liveness/readiness probe while the service is already broken
// (`GLOBAL_CACHE_TTL` is 120s in sample.env, so the stale window is minutes, not the
// default 1s). The behaviour of the opt-out itself is covered in
// `custom-cache.interceptor.spec.ts`; this asserts the decorator stays on the controller.
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  it('opts out of the response cache', () => {
    expect(Reflect.getMetadata(SKIP_CACHE_KEY, HealthController)).toBe(true);
  });

  it('is seen as cache-skipping through the same lookup the interceptor uses', () => {
    const shouldSkip = new Reflector().getAllAndOverride<boolean>(SKIP_CACHE_KEY, [
      HealthController.prototype.check,
      HealthController,
    ]);

    expect(shouldSkip).toBe(true);
  });
});

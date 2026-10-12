import { Reflector } from '@nestjs/core';
import { THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';

import { SKIP_CACHE_KEY } from 'common/decorators';

import { PrometheusController } from './prometheus.controller';

describe('PrometheusController', () => {
  it('opts out of the response cache', () => {
    expect(Reflect.getMetadata(SKIP_CACHE_KEY, PrometheusController)).toBe(true);
  });

  it('opts out of throttling', () => {
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}default`, PrometheusController)).toBe(true);
  });

  it('is seen as cache-skipping through the same lookup the interceptor uses', () => {
    const shouldSkip = new Reflector().getAllAndOverride<boolean>(SKIP_CACHE_KEY, [
      PrometheusController.prototype.index,
      PrometheusController,
    ]);

    expect(shouldSkip).toBe(true);
  });
});

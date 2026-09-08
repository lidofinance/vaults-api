import { Controller, Get, Module, Post } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule as CacheModuleSource } from '@nestjs/cache-manager';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { SkipCache } from 'common/decorators';

import { HttpCacheInterceptor } from './http-cache.interceptor';

// ---------------------------------------------------------------------------
// HttpCacheInterceptor
//
// `APP_INTERCEPTOR` applies application-wide even though it is registered inside
// `HTTPModule`, so the response cache also covers controllers of unrelated modules —
// health and metrics among them. A cached 200 answering a health probe would report a
// healthy service regardless of its real state, so routes that must never be cached
// opt out with `@SkipCache()`, and this suite guards both halves of that contract.
// ---------------------------------------------------------------------------

let counter = 0;
const nextValue = () => ({ n: ++counter });

@Controller('cached')
class CachedController {
  @Get()
  get() {
    return nextValue();
  }

  @Post()
  create() {
    return nextValue();
  }
}

@Controller('skip-class')
@SkipCache()
class SkipOnClassController {
  @Get()
  get() {
    return nextValue();
  }
}

@Controller('skip-handler')
class SkipOnHandlerController {
  @Get()
  @SkipCache()
  get() {
    return nextValue();
  }
}

// The controllers deliberately live in a module of their own: it is what makes the test
// meaningful, since the real health controller also sits outside the module below.
@Module({ controllers: [CachedController, SkipOnClassController, SkipOnHandlerController] })
class ProbeControllersModule {}

// mirrors HTTPModule: registers the cache interceptor globally from a feature module
@Module({
  imports: [CacheModuleSource.register({ ttl: 60_000 })],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor }],
})
class ProbeHttpModule {}

@Module({ imports: [ProbeHttpModule, ProbeControllersModule] })
class ProbeAppModule {}

describe('HttpCacheInterceptor', () => {
  let app: NestFastifyApplication;

  const get = async (url: string) => {
    const response = await app.inject({ method: 'GET', url });
    return { body: response.body, xCache: response.headers['x-cache'] };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeAppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('caches a GET of a controller from another module — the interceptor really is global', async () => {
    const first = await get('/cached');
    const second = await get('/cached');

    expect(second.body).toBe(first.body);
    expect(first.xCache).toBe('MISS');
    expect(second.xCache).toBe('HIT');
  });

  it('does not cache a controller marked with @SkipCache', async () => {
    const first = await get('/skip-class');
    const second = await get('/skip-class');

    expect(second.body).not.toBe(first.body);
    // no X-Cache header at all: the interceptor bails out before touching the cache
    expect(first.xCache).toBeUndefined();
    expect(second.xCache).toBeUndefined();
  });

  it('does not cache a single handler marked with @SkipCache', async () => {
    const first = await get('/skip-handler');
    const second = await get('/skip-handler');

    expect(second.body).not.toBe(first.body);
    expect(second.xCache).toBeUndefined();
  });

  it('leaves non-GET requests alone', async () => {
    const first = await app.inject({ method: 'POST', url: '/cached' });
    const second = await app.inject({ method: 'POST', url: '/cached' });

    expect(second.body).not.toBe(first.body);
  });
});

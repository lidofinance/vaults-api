import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { SKIP_CACHE_KEY } from 'common/decorators/skipCache';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext) {
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(SKIP_CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (shouldSkip) {
      return undefined;
    }

    return super.trackBy(context);
  }
}

import { CacheModule as CacheModuleSource } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from 'common/config';

export const CacheModule = CacheModuleSource.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    // TTL in infra and examples is in seconds, but has been changed to milliseconds
    ttl: configService.get('GLOBAL_CACHE_TTL') * 1000,
  }),
});

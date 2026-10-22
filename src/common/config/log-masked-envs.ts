import { LoggerService } from '@nestjs/common';
import { commonPatterns, satanizer } from '@lidofinance/satanizer';

import { ConfigService } from './config.service';
import { ENV_KEYS, EnvironmentVariables } from './env.validation';
import { PrometheusService } from '../prometheus';

/** Record and log startup configuration with secrets masked */
export function logMaskedStartupConfig(
  configService: ConfigService,
  prometheusService: PrometheusService,
  logger: LoggerService,
): void {
  const mask = satanizer([...commonPatterns, ...configService.secrets]);
  const allConfigEnvs = {};
  ENV_KEYS.forEach((key: keyof EnvironmentVariables) => {
    allConfigEnvs[key] = mask(configService.get(key));
  });

  prometheusService.envsInfo.labels(allConfigEnvs).inc();
  logger.log('Init app dumping envs', allConfigEnvs);
}

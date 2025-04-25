import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { PrometheusService } from 'common/prometheus';
import { APP_NAME, APP_VERSION } from './app.constants';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly configService: ConfigService,
    protected readonly prometheusService: PrometheusService,
    protected readonly executionProviderService: ExecutionProviderService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const env = this.configService.get('NODE_ENV');
    const version = APP_VERSION;
    const name = APP_NAME;

    await this.validateNetwork();

    this.prometheusService.buildInfo.labels({ env, name, version }).inc();
    this.logger.log('Init app', { env, name, version });
  }

  /**
   * Validates the CL and EL chains match
   */
  protected async validateNetwork(): Promise<void> {
    const chainId = this.configService.get('CHAIN_ID');
    const elChainId = await this.executionProviderService.getChainId();

    if (chainId !== elChainId) {
      throw new Error('Chain ids do not match');
    }
  }
}

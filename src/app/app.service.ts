import { DataSource } from 'typeorm';
import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { logMaskedStartupConfig } from 'common/config/log-masked-envs';
import { ExecutionProviderService } from 'common/execution-provider';
import { PrometheusService } from 'common/prometheus';
import { APP_NAME, APP_VERSION, APP_BRANCH, APP_COMMIT } from './app.constants';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly configService: ConfigService,
    protected readonly prometheusService: PrometheusService,
    protected readonly executionProviderService: ExecutionProviderService,
    protected readonly dataSource: DataSource,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.validateNetwork();
    await this.checkDbConnection();
    await this.prometheusBuildInfoMetrics();
    this.prometheusEnvsInfoMetrics();
  }

  protected async checkDbConnection(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        this.logger.log('Database is connected!');
      } else {
        throw new Error('Database connection failed!');
      }
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  /**
   * Validates the EL chain match
   */
  protected async validateNetwork(): Promise<void> {
    const chainId = this.configService.get('CHAIN_ID');
    const elChainId = await this.executionProviderService.getChainId();

    if (chainId !== elChainId) {
      throw new Error('Chain ids do not match');
    }
  }

  protected async prometheusBuildInfoMetrics() {
    const network = await this.executionProviderService.getNetworkName();
    const env = this.configService.get('NODE_ENV');
    const version = APP_VERSION;
    const name = APP_NAME;
    const branch = APP_BRANCH;
    const commit = APP_COMMIT;

    this.prometheusService.buildInfo.labels({ name, version, env, network, branch, commit }).inc();
    this.logger.log('Init app', { name, version, env, network, branch, commit });
  }

  protected prometheusEnvsInfoMetrics(): void {
    logMaskedStartupConfig(this.configService, this.prometheusService, this.logger);
  }
}

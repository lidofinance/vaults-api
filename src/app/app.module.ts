import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { PrometheusModule } from 'common/prometheus';
import { ConfigModule } from 'common/config';
import { ExecutionProviderModule } from 'common/execution-provider';
import { ContractsModule } from 'common/contracts';
import { SentryInterceptor } from 'common/sentry';
import { HealthModule } from 'common/health';

import { HTTPModule } from '../http';
import { LsvModule } from '../lsv';
import { AppService } from './app.service';

@Module({
  imports: [
    ExecutionProviderModule,
    HTTPModule,
    HealthModule,
    PrometheusModule,
    ConfigModule,
    ContractsModule,
    LsvModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: SentryInterceptor }, AppService],
})
export class AppModule {}

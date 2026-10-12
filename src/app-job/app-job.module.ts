import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PrometheusModule, PrometheusService } from 'common/prometheus';
import { ConfigModule } from 'common/config';
import { ExecutionProviderModule } from 'common/execution-provider';
import { LoggerModule, LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { HealthModule } from 'common/health';
import { getTypeOrmConfig } from 'db/config';
import { CustomLogger } from 'db/custom.logger';

import { VaultJobsModule, ReportJobsModule } from '../jobs';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    HealthModule,
    ExecutionProviderModule,
    PrometheusModule,
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [PrometheusService, LOGGER_PROVIDER],
      useFactory: (prometheusService: PrometheusService, logger: LoggerService) => ({
        ...getTypeOrmConfig(),
        logger: new CustomLogger(prometheusService.dbQueryDuration, prometheusService.dbQueryCounter, logger),
      }),
    }),
    VaultJobsModule,
    ReportJobsModule,
  ],
})
export class AppJobModule {}

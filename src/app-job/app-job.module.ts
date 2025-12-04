import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PrometheusModule, PrometheusService } from 'common/prometheus';
import { ConfigModule } from 'common/config';
import { ExecutionProviderModule } from 'common/execution-provider';
import { LoggerModule } from 'common/logger';
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
      inject: [PrometheusService],
      useFactory: (prometheusService: PrometheusService) => ({
        ...getTypeOrmConfig(),
        logger: new CustomLogger(prometheusService.dbQueryDuration, prometheusService.dbQueryCounter),
      }),
    }),
    VaultJobsModule,
    ReportJobsModule,
  ],
})
export class AppJobModule {}

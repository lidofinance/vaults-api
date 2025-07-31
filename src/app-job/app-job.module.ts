import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PrometheusModule, PrometheusService } from 'common/prometheus';
import { ConfigModule } from 'common/config';
import { ExecutionProviderModule } from 'common/execution-provider';
import { LoggerModule } from 'common/logger';
import { getTypeOrmConfig } from 'db/config';
import { CustomLogger } from 'db/custom.logger';

import { VaultJobsModule, ReportJobsModule } from '../jobs';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    ExecutionProviderModule,
    PrometheusModule,
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [PrometheusService],
      useFactory: (prometheusService: PrometheusService) => ({
        ...getTypeOrmConfig(),
        logging: ['query'],
        logger: new CustomLogger(prometheusService.dbQueryDuration, prometheusService.dbQueryErrorCounter),
      }),
    }),
    VaultJobsModule,
    ReportJobsModule,
  ],
})
export class AppJobModule {}

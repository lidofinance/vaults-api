import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { PrometheusModule } from 'common/prometheus';
import { ConfigModule, getTypeOrmConfig } from 'common/config';
import { ExecutionProviderModule } from 'common/execution-provider';
import { LoggerModule } from 'common/logger';

import { VaultJobsModule, ReportJobsModule } from '../jobs';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    ExecutionProviderModule,
    PrometheusModule,
    ConfigModule,
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    VaultJobsModule,
    ReportJobsModule,
  ],
})
export class AppJobModule {}

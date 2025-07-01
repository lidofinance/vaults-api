import { NestFactory } from '@nestjs/core';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { AppJobModule } from './app-job';
import { VaultJobsService, ReportJobsService } from './jobs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppJobModule);

  // logger
  app.useLogger(app.get(LOGGER_PROVIDER));

  app.get(VaultJobsService);
  app.get(ReportJobsService);
}

bootstrap();

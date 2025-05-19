import { NestFactory } from '@nestjs/core';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { AppJobModule } from './app-job';
import { JobsService } from './jobs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppJobModule);

  // logger
  app.useLogger(app.get(LOGGER_PROVIDER));

  const jobsService = app.get(JobsService);

  await jobsService.initialize();
}

bootstrap();

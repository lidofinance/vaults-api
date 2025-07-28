import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { AppJobModule } from './app-job';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppJobModule, new FastifyAdapter({ trustProxy: true }), {
    bufferLogs: true,
  });

  // config
  const configService: ConfigService = app.get(ConfigService);
  const appPort = configService.get('WORKER_PORT');

  // logger
  app.useLogger(app.get(LOGGER_PROVIDER));

  // app
  await app.listen(appPort, '0.0.0.0');
}

bootstrap();

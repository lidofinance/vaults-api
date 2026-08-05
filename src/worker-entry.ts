import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ShutdownSignal } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { registerSecretsRotationRestart } from 'common/shutdown';

import { AppJobModule } from './app-job';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppJobModule, new FastifyAdapter({ trustProxy: true }), {
    bufferLogs: true,
  });

  // config
  const configService: ConfigService = app.get(ConfigService);
  const appPort = configService.get('WORKER_PORT');

  // logger
  const logger = app.get(LOGGER_PROVIDER);
  app.useLogger(logger);

  // TERM/INT are the orchestrator's normal stop signals; OpenBao secret-rotation
  // restarts are file-based (no signal path from the injector sidecar).
  app.enableShutdownHooks([ShutdownSignal.SIGTERM, ShutdownSignal.SIGINT]);
  registerSecretsRotationRestart(app, logger);

  // app
  await app.listen(appPort, '0.0.0.0');
}

bootstrap();

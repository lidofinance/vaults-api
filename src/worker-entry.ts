import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';
import { JobsService } from './jobs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const jobsService = app.get(JobsService);

  try {
    await jobsService.initialize();
    console.log('JobsService was started!');
  } catch (error) {
    console.error('Error while executing task in the JobsService:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();

import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { ReportService } from 'report';
import { VaultService } from 'vault';

@Injectable()
export class ReportJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultService: VaultService,
    private readonly reportService: ReportService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportJobsService initialization started');

    const job = new CronJob(
      this.configService.jobs['reportCron'],
      async () => {
        await this.vaultService.fetchAllVaultsAndCalculateStates();
        await this.reportService.fetchAllReports();
        await this.reportService.calculateVaultMetrics();
      },
      null,
      false,
      this.configService.jobs['reportCronTZ'],
    );

    this.schedulerRegistry.addCronJob('reports-cron', job);
    job.start();

    // one-time execution on startup
    await job.fireOnTick();

    this.reportService.subscribeToEvents();

    this.logger.log('ReportJobsService initialization finished');
  }
}

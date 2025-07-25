import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { TrackJob } from 'common/job/track-job.decorator';
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

    // one-time execution on startup
    await this.run();

    const job = new CronJob(
      this.configService.jobs['reportCron'],
      async () => await this.run(),
      null,
      false,
      this.configService.jobs['reportCronTZ'],
    );

    this.schedulerRegistry.addCronJob('reports-cron', job);
    job.start();

    this.reportService.subscribeToEvents();

    this.logger.log('ReportJobsService initialization finished');
  }

  @TrackJob('ReportJobs')
  async run() {
    await this.vaultService.fetchAllVaultsAndCalculateStates();
    await this.reportService.fetchAllReports();
    await this.reportService.calculate();
  }
}

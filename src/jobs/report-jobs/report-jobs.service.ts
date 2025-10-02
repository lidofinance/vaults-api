import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
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
    private readonly executionProviderService: ExecutionProviderService,
  ) {}

  async onModuleInit() {
    this.logger.log('ReportJobsService initialization started');

    const job = new CronJob(
      this.configService.jobs['reportCron'],
      async () => {
        let blockNumber: number;
        try {
          blockNumber = await this.executionProviderService.getBlockNumber();
        } catch (err) {
          this.logger.error(`[ReportJobsService.onModuleInit.CronJob] Failed to fetch blockNumber: ${err}`);
          return;
        }

        await this.vaultService.fetchAllVaultsAndCalculateStates(blockNumber);
        await this.reportService.fetchAllReports();
        await this.reportService.calculateVaultMetrics();
      },
      null,
      false,
      this.configService.jobs['reportCronTZ'],
    );

    this.schedulerRegistry.addCronJob('reports-cron', job);
    job.start();

    this.reportService.subscribeToEvents();

    this.logger.log('ReportJobsService initialization finished');
  }
}

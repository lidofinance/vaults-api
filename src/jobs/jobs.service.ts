import { CronJob } from 'cron';
import { Injectable, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';

import { VaultJobsService } from './vault-jobs';
import { ReportJobsService } from './report-jobs';

@Injectable()
export class JobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultJobsService: VaultJobsService,
    private readonly reportJobsService: ReportJobsService,
  ) {}

  async onModuleInit() {
    this.logger.log('JobsService initialization started');

    // one-time execution on startup
    await this.vaultJobsService.fetchAllVaultsAndCalculateStates();
    await this.vaultJobsService.fetchAllVaultsRoleMembers();
    await this.reportJobsService.fetchAllReports();
    await this.reportJobsService.calculate();

    const job = new CronJob(
      this.configService.jobs['vaultsHourlyCron'],
      async () => {
        await this.vaultJobsService.fetchAllVaultsAndCalculateStates();
        await this.vaultJobsService.fetchAllVaultsRoleMembers();
        await this.reportJobsService.fetchAllReports();
        await this.reportJobsService.calculate();
      },
      null,
      false,
      this.configService.jobs['vaultsHourlyCronTZ'],
    );

    this.schedulerRegistry.addCronJob('vaults-hourly', job);
    job.start();

    this.logger.log('JobsService initialization finished');
  }
}

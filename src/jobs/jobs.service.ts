import { CronJob } from 'cron';
import { Injectable, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';

import { VaultJobsService } from './vault-jobs';
import { VaultMemberJobsService } from './vault-member-jobs';
import { ReportJobsService } from './report-jobs';
import { ReportStatisticJobsService } from './report-statistic-jobs';

@Injectable()
export class JobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultJobsService: VaultJobsService,
    private readonly vaultMemberJobsService: VaultMemberJobsService,
    private readonly reportJobsService: ReportJobsService,
    private readonly reportStatisticJobsService: ReportStatisticJobsService,
  ) {}

  async onModuleInit() {
    this.logger.log('JobsService initialization started');

    // one-time execution on startup
    // await this.vaultJobsService.fetchAllVaultsAndStateHourly();
    // await this.vaultMemberJobsService.fetchAllVaultsRoleMembers();
    // await this.reportJobsService.fetchAllReports();
    await this.reportStatisticJobsService.calculate();

    const job = new CronJob(
      this.configService.jobs['vaultsHourlyCron'],
      async () => {
        // await this.vaultJobsService.fetchAllVaultsAndStateHourly();
        // await this.vaultMemberJobsService.fetchAllVaultsRoleMembers();
        // await this.reportJobsService.fetchAllReports();
        await this.reportStatisticJobsService.calculate();
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

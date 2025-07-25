import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { TrackJob } from 'common/job/track-job.decorator';
import { VaultService } from 'vault';

@Injectable()
export class VaultJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultService: VaultService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultJobsService initialization started');

    // one-time execution on startup
    await this.run();

    const job = new CronJob(
      this.configService.jobs['vaultsCron'],
      async () => await this.run(),
      null,
      false,
      this.configService.jobs['vaultsCronTZ'],
    );

    this.schedulerRegistry.addCronJob('vaults-cron', job);
    job.start();

    // subscribes to events
    this.vaultService.subscribeToEvents();

    this.logger.log('VaultJobsService initialization finished');
  }

  @TrackJob('VaultJobs')
  async run() {
    await this.vaultService.fetchAllVaultsAndCalculateStates();
    await this.vaultService.fetchAllVaultsRoleMembers();
  }
}

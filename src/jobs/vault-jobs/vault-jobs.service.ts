import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultService } from 'vault';

@Injectable()
export class VaultJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultService: VaultService,
    private readonly executionProviderService: ExecutionProviderService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultJobsService initialization started');

    const jobVaults = new CronJob(
      this.configService.jobs['vaultsCron'],
      async () => {
        let blockNumber: number;
        try {
          blockNumber = await this.executionProviderService.getSafeBlockNumber();
          this.logger.log(`[VaultJobsService.jobVaults.CronJob] blockNumber=${blockNumber}`);
        } catch (err) {
          this.logger.error(`[VaultJobsService.jobVaults.CronJob] Failed to fetch blockNumber: ${err}`);
          return;
        }

        await this.vaultService.fetchAllVaultsAndCalculateStates(blockNumber);
      },
      null,
      false,
      this.configService.jobs['vaultsCronTZ'],
    );
    this.schedulerRegistry.addCronJob('vaults-cron', jobVaults);
    jobVaults.start();

    const jobVaultsMembers = new CronJob(
      this.configService.jobs['vaultMembersCron'],
      async () => {
        let blockNumber: number;
        try {
          blockNumber = await this.executionProviderService.getSafeBlockNumber();
          this.logger.log(`[VaultJobsService.jobVaultsMembers.CronJob] blockNumber=${blockNumber}`);
        } catch (err) {
          this.logger.error(`[VaultJobsService.jobVaultsMembers.CronJob] Failed to fetch blockNumber: ${err}`);
          return;
        }

        await this.vaultService.fetchAllVaultsRoleMembers(blockNumber);
      },
      null,
      false,
      this.configService.jobs['vaultMembersCronTZ'],
    );
    this.schedulerRegistry.addCronJob('vaults-members-cron', jobVaultsMembers);
    jobVaultsMembers.start();

    // subscribes to events
    this.vaultService.subscribeToEvents();

    this.logger.log('VaultJobsService initialization finished');
  }
}

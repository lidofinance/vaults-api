import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultService } from 'vault';

const DISCONNECTED_VAULTS_OWNERSHIP_JOB = 'disconnected-vaults-ownership-cron';
const OWNERSHIP_BACKFILL_JOB = 'vaults-ownership-backfill-cron';
// Gives the execution provider time to warm up before the one-off backfill starts reading on-chain.
const OWNERSHIP_BACKFILL_STARTUP_DELAY_MS = 30_000;

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

    const jobDisconnectedVaultsOwnership = new CronJob(
      this.configService.jobs['disconnectedVaultsOwnershipCron'],
      async () => {
        let blockNumber: number;
        try {
          blockNumber = await this.executionProviderService.getSafeBlockNumber();
          this.logger.log(`[VaultJobsService.jobDisconnectedVaultsOwnership.CronJob] blockNumber=${blockNumber}`);
        } catch (err) {
          this.logger.error(
            `[VaultJobsService.jobDisconnectedVaultsOwnership.CronJob] Failed to fetch blockNumber: ${err}`,
          );
          return;
        }

        await this.vaultService.reconcileDisconnectedVaultOwners(blockNumber);
      },
      null,
      false,
      this.configService.jobs['disconnectedVaultsOwnershipCronTZ'],
    );
    this.schedulerRegistry.addCronJob(DISCONNECTED_VAULTS_OWNERSHIP_JOB, jobDisconnectedVaultsOwnership);
    jobDisconnectedVaultsOwnership.start();

    this.scheduleOwnershipBackfill();

    // subscribes to events
    await this.vaultService.subscribeToEvents();

    this.logger.log('VaultJobsService initialization finished');
  }

  /**
   * Vaults stored before the ownership columns existed need them filled in once. A `Date` cron time
   * makes the job fire exactly once shortly after startup; it is then dropped from the registry.
   * The backfill itself is idempotent, so running it again after a redeploy costs a single query.
   */
  private scheduleOwnershipBackfill(): void {
    const backfillJob = new CronJob(new Date(Date.now() + OWNERSHIP_BACKFILL_STARTUP_DELAY_MS), async () => {
      try {
        const blockNumber = await this.executionProviderService.getSafeBlockNumber();
        this.logger.log(`[VaultJobsService.ownershipBackfill.CronJob] blockNumber=${blockNumber}`);

        await this.vaultService.backfillVaultOwnership(blockNumber);
      } catch (err) {
        this.logger.error(`[VaultJobsService.ownershipBackfill.CronJob] Failed to backfill vault ownership: ${err}`);
      } finally {
        this.schedulerRegistry.deleteCronJob(OWNERSHIP_BACKFILL_JOB);
      }
    });

    this.schedulerRegistry.addCronJob(OWNERSHIP_BACKFILL_JOB, backfillJob);
    backfillJob.start();
  }
}

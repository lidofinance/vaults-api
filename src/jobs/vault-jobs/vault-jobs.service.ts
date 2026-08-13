import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { ExecutionProviderService } from 'common/execution-provider';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultService } from 'vault';

const DISCONNECTED_VAULTS_OWNERSHIP_JOB = 'disconnected-vaults-ownership-cron';
const DISCONNECTED_VAULTS_OWNERSHIP_SCAN_JOB = 'disconnected-vaults-ownership-scan-cron';
const OWNERSHIP_BACKFILL_JOB = 'vaults-ownership-backfill-cron';
// Gives the execution provider time to warm up before the one-off backfill starts reading on-chain.
const OWNERSHIP_BACKFILL_STARTUP_DELAY_MS = 30_000;
// Ceiling for the doubling retry delay, so a long outage settles into a steady 10-minute retry.
const OWNERSHIP_BACKFILL_MAX_RETRY_DELAY_MS = 600_000;

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
      this.configService.jobs['disconnectedVaultsOwnershipReconcileCron'],
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

        // `cron` does not await this callback unless `waitForCompletion` is set, so its own try/catch
        // never sees an async rejection: anything escaping here is an unhandled rejection that takes
        // the worker down. `reconcileDisconnectedVaultOwners` isolates per-vault failures internally,
        // but the DB read and the metric writes around them are not covered.
        try {
          await this.vaultService.reconcileDisconnectedVaultOwners(blockNumber);
        } catch (err) {
          this.logger.error(
            `[VaultJobsService.jobDisconnectedVaultsOwnership.CronJob] Failed to reconcile disconnected ` +
              `vault owners at block ${blockNumber}: ${err}`,
          );
        }
      },
      null,
      false,
      this.configService.jobs['disconnectedVaultsOwnershipCronTZ'],
    );
    this.schedulerRegistry.addCronJob(DISCONNECTED_VAULTS_OWNERSHIP_JOB, jobDisconnectedVaultsOwnership);
    jobDisconnectedVaultsOwnership.start();

    const jobDisconnectedVaultsOwnershipScan = new CronJob(
      this.configService.jobs['disconnectedVaultsOwnershipScanCron'],
      async () => {
        let blockNumber: number;
        try {
          blockNumber = await this.executionProviderService.getSafeBlockNumber();
        } catch (err) {
          this.logger.error(
            `[VaultJobsService.jobDisconnectedVaultsOwnershipScan.CronJob] Failed to fetch blockNumber: ${err}`,
          );
          return;
        }

        // Same as the reconcile job above: `cron` does not await this callback, so an escaping
        // rejection would be unhandled and take the worker down.
        try {
          await this.vaultService.syncDisconnectedVaultOwnersFromLogs(blockNumber);
        } catch (err) {
          this.logger.error(
            `[VaultJobsService.jobDisconnectedVaultsOwnershipScan.CronJob] Failed to scan ownership ` +
              `logs at block ${blockNumber}: ${err}`,
          );
        }
      },
      null,
      false,
      this.configService.jobs['disconnectedVaultsOwnershipScanCronTZ'],
    );
    this.schedulerRegistry.addCronJob(DISCONNECTED_VAULTS_OWNERSHIP_SCAN_JOB, jobDisconnectedVaultsOwnershipScan);
    jobDisconnectedVaultsOwnershipScan.start();

    this.scheduleOwnershipBackfill();

    // subscribes to events
    await this.vaultService.subscribeToEvents();

    this.logger.log('VaultJobsService initialization finished');
  }

  /**
   * TODO: TEMP - remove after ownership fields are backfilled in all environments.
   *
   * Vaults stored before the ownership columns existed need them filled in once. A `Date` cron time
   * makes the job fire exactly once shortly after startup; it is then dropped from the registry.
   * The backfill itself is idempotent, so running it again after a redeploy costs a single query.
   * Watch `ownership_backlog` in Prometheus: once it is 0 in every environment, this and
   * `VaultService.backfillVaultOwnership` can go.
   *
   * It is only dropped once it has actually succeeded. The reasons it can fail are all transient and
   * all likely right after boot — the RPC is not warm yet, or the API replica has not applied the
   * migration that adds the columns — and a backfill that never completes leaves owners unable to find
   * their disconnected vaults, with nothing but one log line to say so. So it is rescheduled instead,
   * with the delay doubling up to a cap.
   */
  private scheduleOwnershipBackfill(delayMs = OWNERSHIP_BACKFILL_STARTUP_DELAY_MS, attempt = 1): void {
    const backfillJob = new CronJob(new Date(Date.now() + delayMs), async () => {
      let succeeded = false;
      try {
        const blockNumber = await this.executionProviderService.getSafeBlockNumber();
        this.logger.log(`[VaultJobsService.ownershipBackfill.CronJob] attempt=${attempt} blockNumber=${blockNumber}`);

        await this.vaultService.backfillVaultOwnership(blockNumber);
        succeeded = true;
      } catch (err) {
        this.logger.error(
          `[VaultJobsService.ownershipBackfill.CronJob] Failed to backfill vault ownership ` +
            `(attempt=${attempt}): ${err}`,
        );
      } finally {
        // The registry rejects a duplicate name, so the finished job has to go before the retry is added.
        this.schedulerRegistry.deleteCronJob(OWNERSHIP_BACKFILL_JOB);

        if (!succeeded) {
          const retryDelayMs = Math.min(delayMs * 2, OWNERSHIP_BACKFILL_MAX_RETRY_DELAY_MS);
          this.logger.warn(
            `[VaultJobsService.ownershipBackfill.CronJob] Retrying vault ownership backfill in ${retryDelayMs}ms`,
          );
          this.scheduleOwnershipBackfill(retryDelayMs, attempt + 1);
        }
      }
    });

    this.schedulerRegistry.addCronJob(OWNERSHIP_BACKFILL_JOB, backfillJob);
    backfillJob.start();
  }
}

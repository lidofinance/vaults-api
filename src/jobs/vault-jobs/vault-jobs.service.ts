import { Cron } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';
import { calculateHealth } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService } from '../../common/contracts/modules/vault-viewer-contract';
import { VaultsService } from '../../vault';
import { VaultsStateHourlyService } from '../../vaults-state-hourly';
import { runInParallelBatches } from '../../common/utils/run-in-parallel-batches';

@Injectable()
export class VaultJobsService {
  private readonly batchSize = 100;

  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultsService: VaultsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
  ) {}

  public async initialize(): Promise<void> {
    this.logger.log('VaultJobsService initialization started');
    // Order is important!
    await this.fetchAllVaults();
    await this.fetchAllVaultsStateHourly();
    this.logger.log('VaultJobsService initialization finished');
  }

  @Cron('0 0 * * *', { timeZone: 'UTC' }) // every day at 00:00 UTC
  public async fetchAllVaults(): Promise<void> {
    this.logger.log('[fetchAllVaults] Started');

    // 1. First batch (0, batchSize - 1) + retrieve total
    const { addresses: initialBatch, leftoverVaults } = await this.vaultViewerContractService.getVaultsConnectedBound(
      0,
      this.batchSize - 1,
    );

    const totalNumber = initialBatch.length + leftoverVaults;
    this.logger.log(`[fetchAllVaults] Total vaults estimated: ${totalNumber}`);

    // Save first batch to DB
    await Promise.all(
      initialBatch.map(async (address) => {
        try {
          await this.vaultsService.addVault(address);
          this.logger.log(`[fetchAllVaults] Vault ${address} saved!`);
        } catch (err) {
          this.logger.warn(`[fetchAllVaults] Vault ${address} not saved: ${err.message}`);
        }
      }),
    );

    // 2. Build remaining ranges, for example: [100–199], [200–299], ...
    const batches: Array<{ from: number; to: number }> = [];

    for (let i = this.batchSize; i < totalNumber; i += this.batchSize) {
      const from = i;
      const to = Math.min(i + this.batchSize - 1, totalNumber - 1);
      batches.push({ from, to });
    }

    // 3. Launch parallel getVaultsConnectedBound calls
    await runInParallelBatches(
      batches,
      async ({ from, to }) => {
        try {
          const { addresses } = await this.vaultViewerContractService.getVaultsConnectedBound(from, to);
          this.logger.log(`[fetchAllVaults] Fetched range [${from}–${to}], received: ${addresses.length} vaults`);

          await Promise.all(
            addresses.map(async (address) => {
              try {
                await this.vaultsService.addVault(address);
                this.logger.log(`[fetchAllVaults] Vault ${address} saved!`);
              } catch (err) {
                this.logger.warn(`[fetchAllVaults] Vault ${address} not saved: ${err.message}`);
              }
            }),
          );
        } catch (err) {
          this.logger.error(`[fetchAllVaults] Failed to fetch range [${from}–${to}]: ${err.message}`);
        }
      },
      5, // parallel limit
    );

    this.logger.log('[fetchAllVaults] Finished');
  }

  @Cron('5 * * * *', { timeZone: 'UTC' }) // every hour at minute 05 UTC (**:05)
  public async fetchAllVaultsStateHourly(): Promise<void> {
    this.logger.log('[fetchAllVaultsStateHourly] Started');

    const batchSize = 50;
    const vaultsCount = await this.vaultsService.getVaultsCount();

    for (let from = 0; from < vaultsCount; from += batchSize) {
      const to = Math.min(from + batchSize, vaultsCount);
      this.logger.log(`[fetchAllVaultsStateHourly] Fetching vaults batch: ${from} to ${to}`);

      const vaultsDataBatch = await this.vaultViewerContractService.getVaultsDataBatch(from, to);

      for (const item of vaultsDataBatch) {
        let vault;
        try {
          vault = await this.vaultsService.getVaultByAddress(item.vault);
        } catch (err) {
          this.logger.warn(`[fetchAllVaultsStateHourly] Vault not found in DB: ${item.vault}`);
          continue;
        }

        try {
          const healthFactor = calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.stEthLiability,
            forceRebalanceThresholdBP: item.forcedRebalanceThreshold,
          });

          await this.vaultsStateHourlyService.add({
            vault,
            totalValue: item.totalValue.toString(),
            stEthLiability: item.stEthLiability.toString(),
            sharesLiability: item.liabilityShares.toString(),
            healthFactor: healthFactor.healthRatio,
            forcedRebalanceThreshold: item.forcedRebalanceThreshold.toString(),
            lidoTreasuryFee: item.lidoTreasuryFee.toString(),
            nodeOperatorFee: item.nodeOperatorFee.toString(),
            updatedAt: new Date(),
            blockNumber: '0', // TODO
            // efficiency: ___, TODO
          });
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsStateHourly] Failed to save vault to DB OR calculateHealth of vault ${item.vault}: ${err}`,
          );
          // continue
        }
      }
    }

    this.logger.log('[fetchAllVaultsStateHourly] finished');
  }
}

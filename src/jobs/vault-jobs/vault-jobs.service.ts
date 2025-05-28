import { Cron } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';
import { calculateHealth } from '@lidofinance/lsv-cli/dist/utils/health/calculate-health';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { VaultViewerContractService } from '../../common/contracts/modules/vault-viewer-contract';
import { ExecutionProviderService } from '../../common/execution-provider';
import { VaultsService } from '../../vault';
import { VaultsStateHourlyService } from '../../vaults-state-hourly';

@Injectable()
export class VaultJobsService {
  private readonly batchSize = 100;

  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultsService: VaultsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
    private readonly executionProviderService: ExecutionProviderService,
  ) {}

  public async initialize(): Promise<void> {
    this.logger.log('VaultJobsService initialization started');
    await this.fetchAllVaultsStateHourly();
    this.logger.log('VaultJobsService initialization finished');
  }

  @Cron('0 * * * *', { timeZone: 'UTC' }) // every hour at minute 00 UTC (**:00)
  public async fetchAllVaultsStateHourly(): Promise<void> {
    this.logger.log('[fetchAllVaultsStateHourly] Started');

    const batchSize = 50;
    const vaultsCount = await this.vaultsService.getVaultsCount();

    for (let from = 0; from < vaultsCount; from += batchSize) {
      const to = Math.min(from + batchSize, vaultsCount);
      this.logger.log(`[fetchAllVaultsStateHourly] Fetching vaults batch: ${from} to ${to}`);

      let vaultsDataBatch;
      try {
        vaultsDataBatch = await this.vaultViewerContractService.getVaultsDataBatch(from, to);
      } catch (err) {
        this.logger.error(`[fetchAllVaultsStateHourly] Failed to fetch vaultsDataBatch (${from}-${to}): ${err}`);
        continue;
      }

      let blockNumber: number;
      try {
        blockNumber = await this.executionProviderService.getBlockNumber();
      } catch (err) {
        this.logger.error(`[fetchAllVaultsStateHourly] Failed to fetch blockNumber for batch (${from}-${to}): ${err}`);
        continue;
      }

      for (const item of vaultsDataBatch) {
        let vault;
        try {
          vault = await this.vaultsService.getOrCreateVaultByAddress(item.vault);
        } catch (err) {
          this.logger.error(`[fetchAllVaultsStateHourly] Failed to get or create vault: ${item.vault} — ${err}`);
          continue;
        }

        try {
          const healthFactor = calculateHealth({
            totalValue: item.totalValue,
            liabilitySharesInStethWei: item.stEthLiability,
            forceRebalanceThresholdBP: item.forcedRebalanceThreshold,
          });

          await this.vaultsStateHourlyService.addOrUpdate({
            vault,
            totalValue: item.totalValue.toString(),
            stEthLiability: item.stEthLiability.toString(),
            sharesLiability: item.liabilityShares.toString(),
            healthFactor: healthFactor.healthRatio,
            forcedRebalanceThreshold: item.forcedRebalanceThreshold.toString(),
            lidoTreasuryFee: item.lidoTreasuryFee.toString(),
            nodeOperatorFee: item.nodeOperatorFee.toString(),
            updatedAt: new Date(),
            blockNumber,
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

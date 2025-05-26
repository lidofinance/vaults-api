import { Cron } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';
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
    this.logger.log('VaultJobsService started');
    // await this.fetchAllVaults();
    await this.fetchAllVaultsStateHourly();
  }

  @Cron('*/10 * * * * *') // every 10s (just for MVP)
  public async fetchAllVaults(): Promise<void> {
    this.logger.log('fetchAllVaults started');

    // 1. First batch (0–99) + retrieve total
    const { addresses: initialBatch, total } = await this.vaultViewerContractService.getVaultsConnectedBound(
      0,
      this.batchSize - 1,
    );

    this.logger.log(`Total vaults found: ${total}`);

    // Save first batch to DB
    await Promise.all(
      initialBatch.map(async (address) => {
        try {
          await this.vaultsService.addVault(address);
          this.logger.log(`Vault ${address} saved!`);
        } catch (err) {
          this.logger.warn(`Vault ${address} not saved: ${err.message}`);
        }
      }),
    );

    // 2. Build remaining ranges: [100–199], [200–299], ...
    const totalNumber = Number(total);
    // TODO: it starts only if 'Vault count in DB' less that 'Vault count in contract'

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
          this.logger.log(`Fetched range [${from}–${to}], received: ${addresses.length} vaults`);

          await Promise.all(
            addresses.map(async (address) => {
              try {
                await this.vaultsService.addVault(address);
                this.logger.log(`Vault ${address} saved!`);
              } catch (err) {
                this.logger.warn(`Vault ${address} not saved: ${err.message}`);
              }
            }),
          );
        } catch (err) {
          this.logger.error(`Failed to fetch range [${from}–${to}]: ${err.message}`);
        }
      },
      5, // max 5 ranges in parallel
    );
  }

  public async fetchAllVaultsStateHourly(): Promise<void> {
    this.logger.log('fetchAllVaultsStateHourly started');
    const vaultsDataBatch = await this.vaultViewerContractService.getVaultsDataBatch(0, 2);

    for (const item of vaultsDataBatch) {
      const vault = await this.vaultsService.getVaultByAddress(item.vault);

      if (!vault) {
        this.logger.warn(`Vault not found in DB: ${item.vault}`);
        continue;
      }

      await this.vaultsStateHourlyService.add({
        vault,
        totalValue: item.totalValue.toString(),
        stEthLiability: item.stEthLiability.toString(),
        sharesLiability: item.liabilityShares.toString(),
        healthFactor: 0, // TODO this.calculateHealthFactor(item),
        forcedRebalanceThreshold: item.forcedRebalanceThreshold.toString(),
        lidoTreasuryFee: item.lidoTreasuryFee.toString(),
        nodeOperatorFee: item.nodeOperatorFee.toString(),
        updatedAt: new Date(),
        blockNumber: '0', // TODO
      });
    }
  }
}

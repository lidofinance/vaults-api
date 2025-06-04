import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { VaultViewerContractService } from '../../common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from '../../common/contracts/modules/vault-hub-contract';
// import { ExecutionProviderService } from '../../common/execution-provider';
import { VaultsService } from '../../vault';
// import { VaultsStateHourlyService } from '../../vaults-state-hourly';
import { ROLE_BYTES32 } from '../../vault-member/vault-member.constants';

@Injectable()
export class VaultMemberJobsService {
  private readonly BATCH_SIZE = 10;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly vaultsService: VaultsService,
    // private readonly vaultsStateHourlyService: VaultsStateHourlyService,
    // private readonly executionProviderService: ExecutionProviderService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultMemberJobsService initialization started');

    // // subscribes to events
    // this.subscribeToEvents();

    this.logger.log('VaultMemberJobsService initialization finished');
  }

  // TODO: naming
  public async fetchAllVaultsRoleMembers(): Promise<void> {
    this.logger.log('[fetchAllVaultsRoleMembers] Started');

    const totalVaults = await this.vaultsService.getVaultsCount();
    this.logger.log(`[fetchAllVaultsRoleMembers] Total vaults: ${totalVaults}`);

    for (let offset = 0; offset < totalVaults; offset += this.BATCH_SIZE) {
      const vaultEntities = await this.vaultsService.getVaults(this.BATCH_SIZE, offset);
      if (vaultEntities.length === 0) break;

      this.logger.log(`[fetchAllVaultsRoleMembers] Processing vaults ${offset}..${offset + vaultEntities.length - 1}`);

      for (const vault of vaultEntities) {
        const vaultAddr = vault.address;
        try {
          const roleMembersMap = await this.vaultViewerContractService.getRoleMembers(vaultAddr, ROLE_BYTES32);
          // console.log('roleMembersMap:', roleMembersMap);
        } catch (err) {
          this.logger.error(
            `[fetchAllVaultsRoleMembers] Error fetching role members for vault ${vaultAddr}: ${err.message}`,
          );
        }
      }
    }

    this.logger.log('[fetchAllVaultsRoleMembers] Finished');
  }

  // private subscribeToEvents() {
  //   this.logger.log('[subscribeToEvents] Subscribing to VaultConnectionSet event');
  // }
}

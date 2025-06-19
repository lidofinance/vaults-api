import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Inject } from '@nestjs/common';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ConfigService } from 'common/config';
import { VaultViewerContractService, RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract';
import { ExecutionProviderService } from 'common/execution-provider';
import { VaultsService } from 'vault';
import { VaultsMemberService } from 'vault-member';
import { ROLE_BYTES32 } from 'vault-member/vault-member.constants';

@Injectable()
export class VaultMemberJobsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    private readonly vaultViewerContractService: VaultViewerContractService,
    private readonly vaultHubContractService: VaultHubContractService,
    private readonly vaultsService: VaultsService,
    private readonly vaultsMemberService: VaultsMemberService,
    private readonly executionProviderService: ExecutionProviderService,
  ) {}

  async onModuleInit() {
    this.logger.log('VaultMemberJobsService initialization started');

    // // subscribes to events
    // this.subscribeToEvents();

    this.logger.log('VaultMemberJobsService initialization finished');
  }

  public async fetchAllVaultsRoleMembers(): Promise<void> {
    this.logger.log('[fetchAllVaultsRoleMembers] Started');

    const totalVaults = await this.vaultsService.getVaultsCount();
    this.logger.log(`[fetchAllVaultsRoleMembers] Total vaults: ${totalVaults}`);

    const batchSize = this.configService.jobs['vaultMembersBatchSize'];

    let blockNumber: number;
    try {
      blockNumber = await this.executionProviderService.getBlockNumber();
    } catch (err) {
      this.logger.error(`[fetchAllVaultsAndStateHourly] Failed to fetch blockNumber for batch: ${err}`);
      return;
    }

    for (let offset = 0; offset < totalVaults; offset += batchSize) {
      const vaultEntities = await this.vaultsService.getVaults(batchSize, offset);
      if (vaultEntities.length === 0) break;

      this.logger.log(`[fetchAllVaultsRoleMembers] Fetching vaults ${offset}..${offset + vaultEntities.length - 1}`);
      const vaultAddresses = vaultEntities.map((vault) => vault.address);

      let batchResults: Array<{ vault: string; roleMembersMap: RoleMembers }>;
      try {
        batchResults = await this.vaultViewerContractService.getRoleMembersBatch(vaultAddresses, ROLE_BYTES32, {
          blockTag: blockNumber,
        });
      } catch (err) {
        this.logger.error(`[fetchAllVaultsRoleMembers] Error fetching batch role members: ${err.message}`);
        continue;
      }

      this.logger.log(`[fetchAllVaultsRoleMembers] Saving vaults ${offset}..${offset + vaultEntities.length - 1}`);
      for (const { vault, roleMembersMap } of batchResults) {
        try {
          await this.vaultsMemberService.setMembersForVault(vault, roleMembersMap);
          this.logger.log(`[fetchAllVaultsRoleMembers] Saved 'membersForVault' data to DB for vault ${vault}`);
        } catch (err) {
          this.logger.error(`[fetchAllVaultsRoleMembers] Error saving role members for vault ${vault}: ${err.message}`);
        }
      }
    }

    this.logger.log('[fetchAllVaultsRoleMembers] Finished');
  }

  // private subscribeToEvents() {
  //   this.logger.log('[subscribeToEvents] Subscribing to VaultConnectionSet event');
  // }
}

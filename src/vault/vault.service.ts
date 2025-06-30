import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleMembers } from 'common/contracts/modules/vault-viewer-contract';

import { Direction, DirectionEnum, SortFields } from './enums';
import { VaultEntity, VaultMemberEntity, VaultsStateHourlyEntity, VaultReportStatsEntity } from './entities';
import { toSnakeCaseColumn } from './utils';

@Injectable()
// TODO: VaultsService ---> VaultServiceDB
export class VaultsService {
  constructor(
    @InjectRepository(VaultEntity)
    private readonly vaultRepo: Repository<VaultEntity>,
    @InjectRepository(VaultMemberEntity)
    private readonly vaultMemberRepo: Repository<VaultMemberEntity>,
    @InjectRepository(VaultsStateHourlyEntity)
    private readonly vaultsStateHourlyRepo: Repository<VaultsStateHourlyEntity>,
    @InjectRepository(VaultReportStatsEntity)
    private readonly vaultReportStatsRepo: Repository<VaultReportStatsEntity>,
  ) {}

  async getVaults(limit = 10, offset = 0): Promise<VaultEntity[]> {
    return await this.vaultRepo.find({
      take: limit,
      skip: offset,
      // ASC (ascending order) - 1 → 2 → 3 → 4 → ...
      order: { id: 'ASC' },
    });
  }

  async getVaultsCount(): Promise<number> {
    return await this.vaultRepo.count();
  }

  async getOrCreateVaultByAddress(address: string): Promise<VaultEntity> {
    let vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      vault = this.vaultRepo.create({ address });
      vault = await this.vaultRepo.save(vault);
    }
    return vault;
  }

  async getStateByVaultAddress(vaultAddress: string): Promise<VaultsStateHourlyEntity | null> {
    return this.vaultsStateHourlyRepo
      .createQueryBuilder('state')
      .leftJoinAndSelect('state.vault', 'vault')
      .where('vault.address = :vaultAddress', { vaultAddress })
      .getOne();
  }

  async addOrUpdateState(entry: Partial<VaultsStateHourlyEntity>): Promise<void> {
    await this.vaultsStateHourlyRepo.upsert(entry, {
      conflictPaths: ['vault'],
      skipUpdateIfNoValuesChanged: false,
    });
  }

  async getVaultsWithRoleAndSorting(
    limit: number,
    offset: number,
    sortBy: SortFields,
    direction: Direction = DirectionEnum.ASC,
    role?: string,
    address?: string,
  ): Promise<
    Array<{
      address: string;
      ens: string | null;
      customName: string | null;
      totalValue: string;
      liabilityStETH: string;
      liabilityShares: string;
      healthFactor: number;
      shareLimit: string;
      reserveRatioBP: number;
      forcedRebalanceThresholdBP: number;
      infraFeeBP: number;
      liquidityFeeBP: number;
      reservationFeeBP: number;
      nodeOperatorFeeRate: string;
      updatedAt: Date;
      blockNumber: number;
    }>
  > {
    // Since the vaults_state_hourly table has exactly one row per vault_id,
    // we can select everything, sort by the field, and apply limit, offset
    const qb = this.vaultsStateHourlyRepo
      .createQueryBuilder('state')
      .innerJoin('state.vault', 'vault')
      .select([
        `vault.address AS "address"`,
        `vault.ens AS "ens"`,
        `vault.custom_name AS "customName"`,
        `state.total_value AS "totalValue"`,
        `state.liability_steth AS "liabilityStETH"`,
        `state.liability_shares AS "liabilityShares"`,
        // Only PostgreSQL!!!
        `CASE
          WHEN state.health_factor = 'Infinity' THEN 'Infinity'
          ELSE state.health_factor::text
        END AS "healthFactor"`,
        `state.share_limit AS "shareLimit"`,
        `state.reserve_ratio_bp AS "reserveRatioBP"`,
        `state.forced_rebalance_threshold_bp AS "forcedRebalanceThresholdBP"`,
        `state.infra_fee_bp AS "infraFeeBP"`,
        `state.liquidity_fee_bp AS "liquidityFeeBP"`,
        `state.reservation_fee_bp AS "reservationFeeBP"`,
        `state.node_operator_fee_rate AS "nodeOperatorFeeRate"`,
        `state.updated_at AS "updatedAt"`,
        `state.block_number AS "blockNumber"`,
      ]);

    if (role && address) {
      qb.innerJoin(
        VaultMemberEntity,
        'member',
        `"member"."vault_id" = "vault"."id"
         AND "member"."role" = :role
         AND "member"."address" = :address`,
        { role, address },
      );
    }

    // Sort by field: The field in the database is named in snake_case, in TypeScript it is camelCase
    qb.orderBy(`state."${toSnakeCaseColumn(sortBy)}"`, direction)
      .limit(limit)
      .offset(offset);

    const rawResult = await qb.getRawMany<{
      address: string;
      ens: string | null;
      customName: string | null;
      totalValue: string;
      liabilityStETH: string;
      liabilityShares: string;
      healthFactor: number;
      shareLimit: string;
      reserveRatioBP: number;
      forcedRebalanceThresholdBP: number;
      infraFeeBP: number;
      liquidityFeeBP: number;
      reservationFeeBP: number;
      nodeOperatorFeeRate: string;
      updatedAt: Date;
      blockNumber: number;
    }>();

    return rawResult;
  }

  /**
   * Updates all members (VaultMemberEntity) for the given vault.
   * Ensures atomicity: deletes all old VaultMemberEntity entries for this vault and creates new ones.
   *
   * Example membersMap:
   * {
   *   'vaults.Permissions.burn': ['0xabc...', '0xdef...'],
   *   'vaults.NodeOperatorFee.NodeOperatorManagerRole': ['0x123...'],
   *   ...
   * }
   */
  async setMembersForVault(vaultAddress: string, membersMap: RoleMembers): Promise<void> {
    const vault = await this.vaultRepo.findOne({
      where: { address: vaultAddress },
    });
    if (!vault) {
      throw new NotFoundException(`Vault with address=${vaultAddress} not found`);
    }

    // Perform an atomic operation: 1) delete old records and 2) save new ones
    await this.vaultMemberRepo.manager.transaction(async (transactionalEntityManager) => {
      // 1) Delete all existing records for this vault
      await transactionalEntityManager.delete(VaultMemberEntity, {
        vault: { id: vault.id },
      });

      // 2) Save new ones
      const toInsert: VaultMemberEntity[] = [];
      for (const role of Object.keys(membersMap)) {
        const addrs = membersMap[role];
        for (const addr of addrs) {
          const member = new VaultMemberEntity();
          member.vault = vault;
          member.address = addr;
          member.role = role;
          toInsert.push(member);
        }
      }

      if (toInsert.length > 0) {
        await transactionalEntityManager.save(VaultMemberEntity, toInsert);
      }
    });
  }

  async addOrUpdateReportStats(entry: Partial<VaultReportStatsEntity>): Promise<void> {
    await this.vaultReportStatsRepo.upsert(entry, {
      conflictPaths: ['vault', 'currentReport', 'previousReport'],
      skipUpdateIfNoValuesChanged: false,
    });
  }
}

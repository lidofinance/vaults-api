import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleMembers } from 'common/contracts/modules/vault-viewer-contract';

import { Direction, DirectionEnum, SortFields } from './enums';
import { VaultEntity, VaultMemberEntity, VaultStateEntity, VaultReportStatEntity } from './entities';
import { toSnakeCaseColumn } from './utils';

// because toSnakeCaseColumn('liabilityStETH') = 'liability_st_e_t_h'
const camelToSnakeExceptions: Record<string, string> = {
  liabilityStETH: 'liability_steth',
  forcedRebalanceThresholdBP: 'forced_rebalance_threshold_bp',
};

const VAULT_REPORT_STATS_SELECT_FIELDS = [
  'stats.rebaseReward AS "rebaseReward"',
  'stats.grossStakingRewards AS "grossStakingRewards"',
  'stats.nodeOperatorRewards AS "nodeOperatorRewards"',
  'stats.dailyLidoFees AS "dailyLidoFees"',
  'stats.netStakingRewards AS "netStakingRewards"',
  'stats.grossStakingAPR AS "grossStakingAPR"',
  'stats.grossStakingAprBps AS "grossStakingAprBps"',
  'stats.grossStakingAprPercent AS "grossStakingAprPercent"',
  'stats.netStakingAPR AS "netStakingAPR"',
  'stats.netStakingAprBps AS "netStakingAprBps"',
  'stats.netStakingAprPercent AS "netStakingAprPercent"',
  'stats.bottomLine AS "bottomLine"',
  'stats.carrySpreadAPR AS "carrySpreadAPR"',
  'stats.carrySpreadAprBps AS "carrySpreadAprBps"',
  'stats.carrySpreadAprPercent AS "carrySpreadAprPercent"',
  'stats.updatedAt AS "updatedAt"',
];

@Injectable()
export class VaultDbService {
  constructor(
    @InjectRepository(VaultEntity)
    private readonly vaultRepo: Repository<VaultEntity>,
    @InjectRepository(VaultMemberEntity)
    private readonly vaultMemberRepo: Repository<VaultMemberEntity>,
    @InjectRepository(VaultStateEntity)
    private readonly vaultStateRepo: Repository<VaultStateEntity>,
    @InjectRepository(VaultReportStatEntity)
    private readonly vaultReportStatRepo: Repository<VaultReportStatEntity>,
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

  async getStateByVaultAddress(vaultAddress: string): Promise<VaultStateEntity | null> {
    return this.vaultStateRepo
      .createQueryBuilder('state')
      .leftJoinAndSelect('state.vault', 'vault')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .getOne();
  }

  async addOrUpdateState(entry: Partial<VaultStateEntity>): Promise<void> {
    await this.vaultStateRepo.upsert(entry, {
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
      grossStakingAPR: string | null;
      grossStakingAprBps: number | null;
      grossStakingAprPercent: number | null;
      carrySpreadAPR: string | null;
      carrySpreadAprBps: number | null;
      carrySpreadAprPercent: number | null;
    }>
  > {
    const qb = this.vaultStateRepo
      .createQueryBuilder('state')
      .innerJoin('state.vault', 'vault')
      .leftJoin(
        (subQuery) => {
          return subQuery
            .select([
              'DISTINCT ON (stats.vault_id) stats.vault_id',
              'stats.gross_staking_apr',
              'stats.gross_staking_apr_bps',
              'stats.gross_staking_apr_percent',
              'stats.carry_spread_apr',
              'stats.carry_spread_apr_bps',
              'stats.carry_spread_apr_percent',
            ])
            .from(VaultReportStatEntity, 'stats')
            .orderBy('stats.vault_id', 'ASC') // required by 'DISTINCT ON (stats.vault_id) stats.vault_id'
            .addOrderBy('stats.updated_at', 'DESC'); // get the latest data for each vault_id
        },
        'report_metrics',
        'report_metrics.vault_id = vault.id',
      )
      .select([
        `vault.address AS "address"`,
        `vault.ens AS "ens"`,
        `vault.custom_name AS "customName"`,
        // vault states
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
        // vault report metrics
        `report_metrics.gross_staking_apr AS "grossStakingAPR"`,
        `report_metrics.gross_staking_apr_bps AS "grossStakingAprBps"`,
        `report_metrics.gross_staking_apr_percent AS "grossStakingAprPercent"`,
        `report_metrics.carry_spread_apr AS "carrySpreadAPR"`,
        `report_metrics.carry_spread_apr_bps AS "carrySpreadAprBps"`,
        `report_metrics.carry_spread_apr_percent AS "carrySpreadAprPercent"`,
      ]);

    if (role && address) {
      qb.innerJoin(
        VaultMemberEntity,
        'member',
        `"member"."vault_id" = "vault"."id"
         AND "member"."role" = :role
         AND LOWER("member"."address") = LOWER(:address)`,
        { role, address },
      );
    }

    qb.orderBy(`state."${toSnakeCaseColumn(sortBy, camelToSnakeExceptions)}"`, direction)
      .limit(limit)
      .offset(offset);

    const rawResult = await qb.getRawMany();

    return rawResult;
  }

  async getLatestVaultReportStats(vaultAddress: string) {
    return this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .orderBy('stats.updatedAt', 'DESC')
      .select(VAULT_REPORT_STATS_SELECT_FIELDS)
      .getRawOne();
  }

  async getVaultReportStatsInRange(
    vaultAddress: string,
    fromTimestamp?: number,
    toTimestamp?: number,
    fromBlock?: number,
    toBlock?: number,
  ) {
    const query = this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .innerJoin('stats.currentReport', 'currentReport')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .orderBy('currentReport.timestamp', 'ASC');

    if (fromBlock !== undefined && toBlock !== undefined) {
      query.andWhere('currentReport.blockNumber BETWEEN :fromBlock AND :toBlock', { fromBlock, toBlock });
    }

    if (fromTimestamp !== undefined && toTimestamp !== undefined) {
      query.andWhere('currentReport.timestamp BETWEEN :fromTimestamp AND :toTimestamp', { fromTimestamp, toTimestamp });
    }

    return query.select(VAULT_REPORT_STATS_SELECT_FIELDS).getRawMany();
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

  async addOrUpdateReportStats(entry: Partial<VaultReportStatEntity>): Promise<void> {
    await this.vaultReportStatRepo.upsert(entry, {
      conflictPaths: ['vault', 'currentReport', 'previousReport'],
      skipUpdateIfNoValuesChanged: false,
    });
  }
}

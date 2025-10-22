import { DataSource, Repository } from 'typeorm';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { ReportEntity, ReportLeafEntity } from 'db/report-db/entities';
import { LABEL_TO_ROLE } from 'vault/vault.constants';

import { Direction, DirectionEnum, SortFields } from './enums';
import { SeriesTimePoint, VaultAprsSma } from './vault-db.types';
import { VaultEntity, VaultMemberEntity, VaultStateEntity, VaultReportStatEntity } from './entities';
import { QUERY_METRICS_COMMENTS } from './vault-db.constants';

const VAULT_REPORT_STATS_SELECT_FIELDS = [
  'stats.rebaseReward AS "rebaseReward"',
  'stats.grossStakingRewards AS "grossStakingRewards"',
  'stats.nodeOperatorRewards AS "nodeOperatorRewards"',
  'stats.dailyLidoFees AS "dailyLidoFees"',
  'stats.netStakingRewards AS "netStakingRewards"',
  'stats.grossStakingAprPercent AS "grossStakingAprPercent"',
  'stats.netStakingAprPercent AS "netStakingAprPercent"',
  'stats.bottomLine AS "bottomLine"',
  'stats.carrySpreadAprPercent AS "carrySpreadAprPercent"',
  'stats.updatedAt AS "updatedAt"',
];

@Injectable()
export class VaultDbService {
  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerService,
    @InjectDataSource() private readonly dataSource: DataSource,
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
    return (
      this.vaultStateRepo
        .createQueryBuilder('state')
        .leftJoinAndSelect('state.vault', 'vault')
        .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_STATE_BY_VAULT_ADDRESS)
        .getOne()
    );
  }

  async addOrUpdateState(entry: Partial<VaultStateEntity>): Promise<void> {
    await this.vaultStateRepo.upsert(entry, {
      conflictPaths: ['vault'],
      skipUpdateIfNoValuesChanged: false,
    });
  }

  async getVaultsWithRoleAndSortingAndReportData(
    limit: number,
    offset: number,
    sortBy: SortFields,
    direction: Direction = DirectionEnum.ASC,
    address?: string,
    role?: string,
  ): Promise<{
    lastReportMeta: {
      cid: string;
      refSlot: number;
      blockNumber: number;
      timestamp: number;
    } | null;
    totalVaults: number;
    vaults: Array<{
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
      isReportFresh: boolean;
      isQuarantineActive: boolean | null;
      quarantinePendingTotalValueIncrease: bigint | null;
      quarantineStartTimestamp: number | null;
      quarantineEndTimestamp: number | null;
      rebaseReward: string | null;
      grossStakingRewards: string | null;
      nodeOperatorRewards: string | null;
      dailyLidoFees: string | null;
      netStakingRewards: string | null;
      grossStakingAprPercent: number | null;
      netStakingAprPercent: number | null;
      bottomLine: string | null;
      carrySpreadAprPercent: number | null;
      lastReport: {
        totalValueWei: string | null;
        inOutDelta: string | null;
        fee: string | null;
        liabilityShares: string | null;
        slashingReserve: string | null;
      };
    }>;
  }> {
    // Use a transaction to ensure both queries see the same database snapshot,
    // avoiding possible inconsistencies between two separate queries.
    return this.dataSource.transaction(async (manager) => {
      const lastReportMeta = await manager
        .getRepository(ReportEntity)
        .createQueryBuilder('report')
        .select([
          'report.cid AS "cid"',
          'report.refSlot AS "refSlot"',
          'report.blockNumber AS "blockNumber"',
          'report.timestamp AS "timestamp"',
        ])
        .orderBy('report.blockNumber', 'DESC')
        .limit(1)
        .getRawOne();

      const vaultsSubQuery = manager
        .getRepository(VaultStateEntity)
        .createQueryBuilder('state')
        .innerJoin('state.vault', 'vault')
        // join ReportEntity and ReportLeafEntity
        .leftJoin(
          (subQuery) =>
            subQuery
              .select([
                'DISTINCT ON (rl."vault_address") rl."vault_address"',
                'rl."total_value_wei"',
                'rl."in_out_delta"',
                'rl."fee"',
                'rl."liability_shares"',
                'rl."slashing_reserve"',
                'r."blockNumber"',
                'r."timestamp"',
              ])
              .from(ReportLeafEntity, 'rl')
              .innerJoin(ReportEntity, 'r', 'r.id = rl."reportId"')
              .orderBy('rl."vault_address"', 'ASC') // required by 'DISTINCT ON (rl."vault_address") rl."vault_address"'
              .addOrderBy('r."blockNumber"', 'DESC'), // get the latest data
          'last_report',
          'last_report."vault_address" = vault.address',
        )
        // join VaultReportStat (Report Metrics)
        .leftJoin(
          (subQuery) => {
            return subQuery
              .select([
                'DISTINCT ON (report_stat.vault_id) report_stat.vault_id',
                'report_stat.rebase_reward',
                'report_stat.gross_staking_rewards',
                'report_stat.node_operator_rewards',
                'report_stat.daily_lido_fees',
                'report_stat.net_staking_rewards',
                'report_stat.gross_staking_apr_percent',
                'report_stat.net_staking_apr_percent',
                'report_stat.bottom_line',
                'report_stat.carry_spread_apr_percent',
              ])
              .from(VaultReportStatEntity, 'report_stat')
              .innerJoin(ReportEntity, 'r', 'r.id = report_stat.current_report_id')
              .orderBy('report_stat.vault_id', 'ASC') // required by 'DISTINCT ON (report_stat.vault_id) report_stat.vault_id'
              .addOrderBy('r.blockNumber', 'DESC') // get the latest data by 'report.blockNumber'
              .addOrderBy('report_stat.updated_at', 'DESC'); // get the latest data by 'report_stat.updated_at'
          },
          'report_metrics',
          'report_metrics.vault_id = vault.id',
        )
        .select([
          `DISTINCT ON (vault.id) vault.address AS "address"`,
          `vault.ens AS "ens"`,
          `vault.custom_name AS "customName"`,

          // vault states
          `state.total_value AS "totalValue"`,
          `state.liability_steth AS "liabilityStETH"`,
          `state.liability_shares AS "liabilityShares"`,
          `state.health_factor AS "healthFactor"`,
          `state.share_limit AS "shareLimit"`,
          `state.reserve_ratio_bp AS "reserveRatioBP"`,
          `state.forced_rebalance_threshold_bp AS "forcedRebalanceThresholdBP"`,
          `state.infra_fee_bp AS "infraFeeBP"`,
          `state.liquidity_fee_bp AS "liquidityFeeBP"`,
          `state.reservation_fee_bp AS "reservationFeeBP"`,
          `state.node_operator_fee_rate AS "nodeOperatorFeeRate"`,
          `state.updated_at AS "updatedAt"`,
          `state.block_number AS "blockNumber"`,
          `state.is_report_fresh AS "isReportFresh"`,
          `state.is_quarantine_active AS "isQuarantineActive"`,
          `state.quarantine_pending_total_value_increase AS "quarantinePendingTotalValueIncrease"`,
          `state.quarantine_start_timestamp AS "quarantineStartTimestamp"`,
          `state.quarantine_end_timestamp AS "quarantineEndTimestamp"`,

          // vault report metrics
          `report_metrics.rebase_reward AS "rebaseReward"`,
          `report_metrics.gross_staking_rewards AS "grossStakingRewards"`,
          `report_metrics.node_operator_rewards AS "nodeOperatorRewards"`,
          `report_metrics.daily_lido_fees AS "dailyLidoFees"`,
          `report_metrics.net_staking_rewards AS "netStakingRewards"`,
          `report_metrics.gross_staking_apr_percent AS "grossStakingAprPercent"`,
          `report_metrics.net_staking_apr_percent AS "netStakingAprPercent"`,
          `report_metrics.bottom_line AS "bottomLine"`,
          `report_metrics.carry_spread_apr_percent AS "carrySpreadAprPercent"`,

          // last report
          // `jsonb_build_object` is PostgreSQL-specific!!!
          // Use '::text' to ensure fields like 'totalValueWei' and others, which are BIGINT or stored as NUMERIC,
          // are returned as strings, preventing precision loss in JavaScript due to IEEE 754 limitations.
          `jsonb_build_object(
            'totalValueWei', last_report.total_value_wei::text,
            'inOutDelta', last_report.in_out_delta::text,
            'fee', last_report.fee::text,
            'liabilityShares', last_report.liability_shares::text,
            'slashingReserve', last_report.slashing_reserve::text
          ) AS "lastReport"`,
        ])
        // required by `DISTINCT ON (vault.id) vault.address AS "address"`
        .orderBy('vault.id', 'ASC')
        .addOrderBy('state.block_number', 'DESC') // get the latest data by 'block_number'
        .addOrderBy('state.updated_at', 'DESC'); // get the latest data by 'updated_at'

      if (role && address) {
        vaultsSubQuery.innerJoin(
          VaultMemberEntity,
          'member',
          `"member"."vault_id" = "vault"."id"
          AND "member"."role" = :role
          AND LOWER("member"."address") = LOWER(:address)`,
          { role: LABEL_TO_ROLE[role], address },
        );
      } else if (address) {
        vaultsSubQuery.innerJoin(
          VaultMemberEntity,
          'member',
          `"member"."vault_id" = "vault"."id"
          AND LOWER("member"."address") = LOWER(:address)`,
          { address },
        );
      }

      const countQuery = manager
        .createQueryBuilder()
        .select('COUNT(*)', 'total')
        .from(`(${vaultsSubQuery.getQuery()})`, 'vaults_sorted')
        .setParameters(vaultsSubQuery.getParameters())
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_COUNT);
      const totalVaults = parseInt((await countQuery.getRawOne()).total, 10);

      // Perform pagination and sorting on the final result set itself,
      // not on the selection of rows within DISTINCT ON (vault.id) groups.
      let vaultsQuery = manager
        .createQueryBuilder()
        .select('*')
        .from(`(${vaultsSubQuery.getQuery()})`, 'vaults_sorted')
        // Use 'NULLS LAST' to ensure records with NULL in the sort field always appear at the bottom (regardless of ASC or DESC)
        .orderBy(`vaults_sorted."${sortBy}"`, direction, 'NULLS LAST')
        .limit(limit)
        .offset(offset)
        .setParameters(vaultsSubQuery.getParameters());

      // Format healthFactor after sorting is already applied
      vaultsQuery = manager
        .createQueryBuilder()
        .select([
          '*',
          // `CASE` is PostgreSQL-specific!!!
          `CASE
            WHEN "healthFactor" = 'Infinity' THEN 'Infinity'
            ELSE "healthFactor"::text
          END AS "healthFactor"`,
        ])
        .from(`(${vaultsQuery.getQuery()})`, 'vaults_formatted')
        .setParameters(vaultsQuery.getParameters())
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_VAULTS);

      const vaults = await vaultsQuery.getRawMany();

      return {
        lastReportMeta,
        totalVaults,
        vaults,
      };
    });
  }

  async getLatestVaultReportStats(vaultAddress: string) {
    return (
      this.vaultReportStatRepo
        .createQueryBuilder('stats')
        .innerJoin('stats.vault', 'vault')
        .innerJoin('stats.currentReport', 'currentReport')
        .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
        .orderBy('currentReport.timestamp', 'DESC')
        .select(VAULT_REPORT_STATS_SELECT_FIELDS)
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_LATEST_VAULT_REPORT_STATS)
        .getRawOne()
    );
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
      .orderBy('currentReport.timestamp', 'DESC');

    if (fromBlock !== undefined && toBlock !== undefined) {
      query.andWhere('currentReport.blockNumber BETWEEN :fromBlock AND :toBlock', { fromBlock, toBlock });
    }

    if (fromTimestamp !== undefined && toTimestamp !== undefined) {
      query.andWhere('currentReport.timestamp BETWEEN :fromTimestamp AND :toTimestamp', { fromTimestamp, toTimestamp });
    }
    return (
      query
        .select([
          ...VAULT_REPORT_STATS_SELECT_FIELDS,
          'currentReport.blockNumber AS "blockNumber"',
          'currentReport.timestamp AS "timestamp"',
          'currentReport.cid AS "reportCid"',
        ])
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULT_REPORT_STATS_IN_RANGE)
        .getRawMany()
    );
  }

  async getLatestReportTimestampForVault(vaultAddress: string): Promise<number | null> {
    const latestReport = await this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .innerJoin('stats.currentReport', 'currentReport')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .select('currentReport.timestamp', 'timestamp')
      .orderBy('currentReport.timestamp', 'DESC')
      .limit(1)
      .getRawOne<{ timestamp: number }>();

    return latestReport?.timestamp ?? null;
  }

  async getVaultAprSmaForDays(vaultAddress: string, days: number): Promise<VaultAprsSma | null> {
    const toTimestamp = await this.getLatestReportTimestampForVault(vaultAddress);
    if (!toTimestamp) return null;

    const fromTimestamp = toTimestamp - days * 24 * 60 * 60; // math for converting days to seconds

    const rows = await this.getVaultReportStatsInRange(vaultAddress, fromTimestamp, toTimestamp, undefined, undefined);

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const grossStakingAprPercentSeries: SeriesTimePoint[] = rows.map((row) => ({
      cid: row.cid,
      timestamp: row.timestamp,
      value: row.grossStakingAprPercent ?? 0,
    }));

    const netStakingAprPercentSeries: SeriesTimePoint[] = rows.map((row) => ({
      cid: row.cid,
      timestamp: row.timestamp,
      value: row.netStakingAprPercent ?? 0,
    }));

    const carrySpreadAprPercentSeries: SeriesTimePoint[] = rows.map((row) => ({
      cid: row.cid,
      timestamp: row.timestamp,
      value: row.carrySpreadAprPercent ?? 0,
    }));

    return {
      windowDays: days,
      count: rows.length,
      range: { fromTimestamp, toTimestamp },

      grossStakingAprPercent: {
        sma: avg(grossStakingAprPercentSeries.map((x) => x.value)),
        series: grossStakingAprPercentSeries,
      },
      netStakingAprPercent: {
        sma: avg(netStakingAprPercentSeries.map((x) => x.value)),
        series: netStakingAprPercentSeries,
      },
      carrySpreadAprPercent: {
        sma: avg(carrySpreadAprPercentSeries.map((x) => x.value)),
        series: carrySpreadAprPercentSeries,
      },
    };
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

  async existsAnyStatsForReportPair(prevReportId: number, currReportId: number): Promise<boolean> {
    const row = await this.vaultReportStatRepo.findOne({
      where: {
        previousReport: { id: prevReportId },
        currentReport: { id: currReportId },
      },
      select: { id: true },
      loadRelationIds: true,
    });
    return !!row;
  }
}

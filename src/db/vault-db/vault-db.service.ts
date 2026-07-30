import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { constants } from 'ethers';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { RoleMembers } from 'common/contracts/modules/vault-viewer-contract';
import { DASHBOARD_OWNER_ROLE, STAKING_VAULT_OWNER_ROLE } from 'vault/vault.constants';
import { ReportEntity } from 'db/report-db/entities';

import { Direction, DirectionEnum, SortFields } from './enums';
import { VaultEntity, VaultMemberEntity, VaultStateEntity, VaultReportStatEntity } from './entities';
import { SeriesReportPoint, VaultAprSma, VaultData } from './vault-db.types';
import { QUERY_METRICS_COMMENTS, SECONDS_PER_DAY } from './vault-db.constants';
import { buildFormattedVaultsQuery, buildVaultsBaseQuery } from './vault-db.queries';

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
  'stats.anomaly AS "anomaly"',
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

  async getVaults(limit = 10, offset = 0, filter?: { isDisconnected?: boolean }): Promise<VaultEntity[]> {
    return await this.vaultRepo.find({
      where: filter?.isDisconnected === undefined ? {} : { isDisconnected: filter.isDisconnected },
      take: limit,
      skip: offset,
      // ASC (ascending order) - 1 → 2 → 3 → 4 → ...
      order: { id: 'ASC' },
    });
  }

  async getVaultsCount(filter?: { isDisconnected?: boolean }): Promise<number> {
    if (filter?.isDisconnected !== undefined) {
      return this.vaultRepo.count({
        where: { isDisconnected: filter.isDisconnected },
      });
    }

    return this.vaultRepo.count();
  }

  /**
   * Vaults created before the ownership columns existed — the one-off backfill input.
   * Paginated by an id cursor rather than an offset: filled rows drop out of the result set,
   * so an offset would skip the vaults that shifted into its place.
   */
  async getVaultsWithoutOwnership(limit: number, afterId = 0): Promise<VaultEntity[]> {
    return this.vaultRepo.find({
      where: { effectiveOwnerAddress: IsNull(), id: MoreThan(afterId) },
      take: limit,
      order: { id: 'ASC' },
    });
  }

  /**
   * Disconnected vaults with no Dashboard owner recorded. Either the owner is a plain address (there
   * is nothing to record) or the rows were lost to a `VaultViewer` zero-response refresh, which is
   * what the role members repair looks for. Paginated by an id cursor for the same reason as
   * {@link getVaultsWithoutOwnership}.
   */
  async getDisconnectedVaultsWithoutDashboardOwner(limit: number, afterId = 0): Promise<VaultEntity[]> {
    return this.vaultRepo
      .createQueryBuilder('vault')
      .where('vault.is_disconnected = true')
      .andWhere('vault.id > :afterId', { afterId })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM vault_members m
          WHERE m.vault_id = vault.id AND m.role = :dashboardOwnerRole
        )`,
        { dashboardOwnerRole: DASHBOARD_OWNER_ROLE },
      )
      .orderBy('vault.id', 'ASC')
      .take(limit)
      .getMany();
  }

  async getAllConnectedVaultAddresses(): Promise<string[]> {
    const rows = await this.vaultRepo.find({
      where: { isDisconnected: false },
      select: ['address'],
    });
    return rows.map((vault) => vault.address);
  }

  async getAllDisconnectedVaultAddresses(): Promise<string[]> {
    const rows = await this.vaultRepo.find({
      where: { isDisconnected: true },
      select: ['address'],
      order: { id: 'ASC' },
    });
    return rows.map((vault) => vault.address);
  }

  async getOrCreateVaultByAddress(address: string, createOpts?: { isDisconnected?: boolean }): Promise<VaultEntity> {
    let vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      vault = this.vaultRepo.create({
        address,
        isDisconnected: createOpts?.isDisconnected ?? true,
      });
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

  /** `connectionOwnerAddress` is `VaultHub`'s `connection.owner` — the effective owner while connected. */
  async connectVault(vaultAddress: string, blockNumber: number, connectionOwnerAddress: string): Promise<void> {
    await this.updateVaultOwnershipColumns(
      vaultAddress,
      blockNumber,
      { isDisconnected: false, effectiveOwnerAddress: connectionOwnerAddress },
      {},
    );
  }

  /**
   * `effectiveOwnerAddress` may be `null` when the `StakingVault` has not named a new owner yet — the
   * vault is still marked disconnected, but the previously recorded owner is left in place rather than
   * overwritten with a sentinel nobody can query by.
   */
  async disconnectVault(
    vaultAddress: string,
    blockNumber: number,
    effectiveOwnerAddress: string | null,
  ): Promise<void> {
    await this.updateVaultOwnershipColumns(
      vaultAddress,
      blockNumber,
      effectiveOwnerAddress === null ? { isDisconnected: true } : { isDisconnected: true, effectiveOwnerAddress },
      {},
    );
  }

  async updateVaultOwnership(
    vaultAddress: string,
    effectiveOwnerAddress: string,
    blockNumber: number,
    opts: { onlyDisconnected?: boolean } = {},
  ): Promise<void> {
    await this.updateVaultOwnershipColumns(
      vaultAddress,
      blockNumber,
      { effectiveOwnerAddress },
      { onlyDisconnected: opts.onlyDisconnected },
    );
  }

  async addOrUpdateState(entry: Partial<VaultStateEntity>): Promise<void> {
    await this.vaultStateRepo.upsert(entry, {
      conflictPaths: ['vault'],
      skipUpdateIfNoValuesChanged: false,
    });
  }

  async getVaultData(vaultAddress: string): Promise<VaultData | null> {
    return this.dataSource.transaction(async (manager) => {
      const vaultBaseQuery = buildVaultsBaseQuery(manager, {
        includeDisconnected: true,
        vaultAddress,
      }).limit(1);

      const vault = await buildFormattedVaultsQuery(manager, vaultBaseQuery)
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULT_BY_ADDRESS)
        .getRawOne<VaultData>();

      return vault ?? null;
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
    vaults: VaultData[];
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

      // Filtering by an address is the owner's personal view, so it has to surface the vaults
      // they still own after a disconnect. The unfiltered list stays connected-only.
      const isPersonalView = !!address;

      const vaultsBaseQuery = buildVaultsBaseQuery(manager, {
        includeDisconnected: isPersonalView,
        memberAddress: address,
        memberRole: role,
      });

      const countQuery = manager
        .createQueryBuilder()
        .select('COUNT(*)', 'total')
        .from(`(${vaultsBaseQuery.getQuery()})`, 'vaults_sorted')
        .setParameters(vaultsBaseQuery.getParameters())
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_COUNT);

      const totalVaults = parseInt((await countQuery.getRawOne()).total, 10);

      // Perform pagination and sorting on the final result set itself,
      // not on the selection of rows within DISTINCT ON (vault.id) groups.
      const vaultsQuery = manager
        .createQueryBuilder()
        .select('*')
        .from(`(${vaultsBaseQuery.getQuery()})`, 'vaults_sorted')
        // Use 'NULLS LAST' to ensure records with NULL in the sort field always appear at the bottom (regardless of ASC or DESC)
        .orderBy(`vaults_sorted."${sortBy}"`, direction, 'NULLS LAST')
        .limit(limit)
        .offset(offset)
        .setParameters(vaultsBaseQuery.getParameters());

      const vaults = await buildFormattedVaultsQuery(manager, vaultsQuery)
        // for metrics
        .comment(QUERY_METRICS_COMMENTS.GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_VAULTS)
        .getRawMany<VaultData>();

      return {
        lastReportMeta,
        totalVaults,
        vaults,
      };
    });
  }

  async getTvl(): Promise<{ tvlWei: string; updatedAt: Date | null }> {
    const row = await this.vaultStateRepo
      .createQueryBuilder('state')
      .innerJoin('state.vault', 'vault')
      .where('vault.is_disconnected = false')
      .select([
        // numeric(78,0) -> string
        `COALESCE(SUM(state.total_value), 0)::text AS "tvlWei"`,
        `MAX(state.updated_at) AS "updatedAt"`,
      ])
      .getRawOne<{ tvlWei: string; updatedAt: Date | null }>();

    return {
      tvlWei: row?.tvlWei ?? '0',
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async getLatestVaultReportStats(vaultAddress: string) {
    const exists = await this.existsVaultByAddress(vaultAddress);
    if (!exists) return null;

    const latestStats = await this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .innerJoin('stats.currentReport', 'currentReport')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .orderBy('currentReport.timestamp', 'DESC')
      .select(['stats.anomaly AS "anomaly"'])
      // for metrics
      .comment(QUERY_METRICS_COMMENTS.GET_LATEST_VAULT_REPORT_STATS)
      .getRawOne();

    const latestNotAnomalyStats = await this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .innerJoin('stats.currentReport', 'currentReport')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .andWhere('stats.anomaly = false')
      .orderBy('currentReport.timestamp', 'DESC')
      .select(VAULT_REPORT_STATS_SELECT_FIELDS)
      // for metrics
      .comment(QUERY_METRICS_COMMENTS.GET_LATEST_VAULT_REPORT_STATS)
      .getRawOne();

    const outdated = latestStats?.anomaly === true;

    if (!latestNotAnomalyStats) {
      return {
        rebaseReward: 0,
        grossStakingRewards: '0',
        nodeOperatorRewards: '0',
        dailyLidoFees: '0',
        netStakingRewards: '0',
        grossStakingAprPercent: 0,
        netStakingAprPercent: 0,
        bottomLine: '0',
        carrySpreadAprPercent: 0,
        updatedAt: null,
        outdated,
      };
    }

    delete latestNotAnomalyStats.anomaly;

    return {
      ...latestNotAnomalyStats,
      outdated,
    };
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
          'stats.anomaly AS "anomaly"',
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

  async getVaultAprSmaForDays(vaultAddress: string, days: number): Promise<VaultAprSma> {
    const exists = await this.existsVaultByAddress(vaultAddress);
    if (!exists) return null;

    const zeroData = (fromTimestamp = 0, toTimestamp = 0, outdated = false): VaultAprSma => ({
      outdated,
      days,
      count: 0,
      range: { fromTimestamp, toTimestamp },
      meta: [],
      grossStakingApr: { sma: 0, aprs: [] },
      netStakingApr: { sma: 0, aprs: [] },
      carrySpreadApr: { sma: 0, aprs: [] },
    });

    const latestTimestamp = await this.getLatestReportTimestampForVault(vaultAddress);
    if (!latestTimestamp) return zeroData();

    // Find the latest NON-anomalous metric.
    // APR SMA window must end at the latest valid point, not necessarily at the latest report.
    const latestValidRow = await this.vaultReportStatRepo
      .createQueryBuilder('stats')
      .innerJoin('stats.vault', 'vault')
      .innerJoin('stats.currentReport', 'currentReport')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .andWhere('stats.anomaly = false')
      .select('currentReport.timestamp', 'timestamp')
      .orderBy('currentReport.timestamp', 'DESC')
      .limit(1)
      .getRawOne<{ timestamp: number }>();

    const toTimestamp = latestValidRow?.timestamp ?? null;
    if (!toTimestamp) return zeroData(0, latestTimestamp, true);
    // Round the fromTimestamp report down to 00:00 UTC.
    // This ensures a consistent N-day window ending at midnight.
    // Example:
    //  - fromTimestamp = 2025-10-16 00:00:00 UTC
    //  - toTimestamp = 2025-10-22 xx:yy:zz UTC
    //  - Reports:
    //    1) 2025-10-16 03:30
    //    2) 2025-10-17 05:30
    //    3) 2025-10-18 05:30
    //    4) 2025-10-19 06:30
    //    5) 2025-10-20 05:30
    //    6) 2025-10-21 04:31
    //    7) 2025-10-22 05:30
    let fromTimestamp = toTimestamp - (days - 1) * SECONDS_PER_DAY;
    fromTimestamp = fromTimestamp - (fromTimestamp % SECONDS_PER_DAY);

    const rows = await this.getVaultReportStatsInRange(vaultAddress, fromTimestamp, toTimestamp, undefined, undefined);
    if (rows.length === 0) return zeroData(fromTimestamp, toTimestamp, latestTimestamp !== toTimestamp);

    // Exclude anomaly=true rows from SMA calculation.
    const validRows = rows.filter((row) => row.anomaly === false);

    if (validRows.length === 0) {
      return zeroData(fromTimestamp, toTimestamp, latestTimestamp !== toTimestamp);
    }

    const meta: SeriesReportPoint[] = [];
    const grossStakingAprPercentSeries: number[] = [];
    const netStakingAprPercentSeries: number[] = [];
    const carrySpreadAprPercentSeries: number[] = [];

    let grossStakingAprPercentSum = 0;
    let netStakingAprPercentSum = 0;
    let carrySpreadAprPercentSum = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      meta[i] = { reportCid: row.reportCid, timestamp: row.timestamp };

      grossStakingAprPercentSeries[i] = row.grossStakingAprPercent;
      netStakingAprPercentSeries[i] = row.netStakingAprPercent;
      carrySpreadAprPercentSeries[i] = row.carrySpreadAprPercent;

      grossStakingAprPercentSum += row.grossStakingAprPercent;
      netStakingAprPercentSum += row.netStakingAprPercent;
      carrySpreadAprPercentSum += row.carrySpreadAprPercent;
    }

    const outdated = latestTimestamp !== toTimestamp;

    return {
      outdated,
      days,
      count: validRows.length,
      range: { fromTimestamp, toTimestamp },
      meta,
      grossStakingApr: {
        sma: grossStakingAprPercentSum / validRows.length,
        aprs: grossStakingAprPercentSeries,
      },
      netStakingApr: {
        sma: netStakingAprPercentSum / validRows.length,
        aprs: netStakingAprPercentSeries,
      },
      carrySpreadApr: {
        sma: carrySpreadAprPercentSum / validRows.length,
        aprs: carrySpreadAprPercentSeries,
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

      // 3) Remember which owner answered for these roles. `VaultViewer` resolves them through the
      // vault owner and reports it back under `STAKING_VAULT_OWNER_ROLE`, so it is the provenance
      // of the rows just written: once the vault moves to another owner they stop being valid.
      // A zero address means the viewer had no connection record to resolve them through, which is
      // not a provenance — recording it would assert these rows belong to nobody.
      const membersOwner = membersMap[STAKING_VAULT_OWNER_ROLE]?.[0];
      await transactionalEntityManager.update(VaultEntity, vault.id, {
        membersOwnerAddress: !membersOwner || membersOwner === constants.AddressZero ? null : membersOwner,
      });
    });
  }

  /**
   * Recovers `membersOwnerAddress` for rows written before the column existed.
   * `VaultViewer` reports the owner it resolved the roles through under `STAKING_VAULT_OWNER_ROLE`,
   * so the provenance is already in `vault_members` — no on-chain reads needed.
   */
  async backfillMembersOwnerFromRoleMembers(): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(VaultEntity)
      .set({
        membersOwnerAddress: () =>
          `(SELECT m.address FROM vault_members m
            WHERE m.vault_id = vaults.id AND m.role = :ownerRole AND m.address <> :zeroAddress
            LIMIT 1)`,
      })
      .where('members_owner_address IS NULL')
      // Zero-address rows are the artefact of refreshing a disconnected vault through `VaultViewer`;
      // they name no owner, so leaving the column NULL is the honest outcome.
      .andWhere(
        `EXISTS (
          SELECT 1 FROM vault_members m
          WHERE m.vault_id = vaults.id AND m.role = :ownerRole AND m.address <> :zeroAddress
        )`,
      )
      .setParameter('ownerRole', STAKING_VAULT_OWNER_ROLE)
      .setParameter('zeroAddress', constants.AddressZero)
      .execute();

    return result.affected ?? 0;
  }

  async addOrUpdateReportStats(entry: Partial<VaultReportStatEntity>): Promise<void> {
    await this.vaultReportStatRepo.upsert(entry, {
      conflictPaths: ['vault', 'currentReport', 'previousReport'],
      skipUpdateIfNoValuesChanged: false,
    });
  }

  async existsVaultByAddress(vaultAddress: string): Promise<boolean> {
    return this.vaultRepo
      .createQueryBuilder('vault')
      .where('LOWER(vault.address) = LOWER(:vaultAddress)', { vaultAddress })
      .getExists();
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

  /**
   * Ownership updates arrive both from contract events and from crons reading a safe (lagging)
   * block, so they can be applied out of order. `ownership_block_number` keeps them monotonic:
   * an update coming from an older block is discarded.
   *
   * Discarding is expected and normal, but it must not be invisible: a write that matched no row is
   * also how a missing vault row or a case-mangled address would look, so the reason is logged.
   */
  private async updateVaultOwnershipColumns(
    vaultAddress: string,
    blockNumber: number,
    values: Partial<Pick<VaultEntity, 'isDisconnected' | 'effectiveOwnerAddress'>>,
    opts: { onlyDisconnected?: boolean },
  ): Promise<void> {
    const query = this.vaultRepo
      .createQueryBuilder()
      .update(VaultEntity)
      .set({ ...values, ownershipBlockNumber: blockNumber })
      .where('LOWER(address) = LOWER(:vaultAddress)', { vaultAddress })
      .andWhere('ownership_block_number <= :blockNumber', { blockNumber });

    if (opts.onlyDisconnected) {
      query.andWhere('is_disconnected = true');
    }

    const result = await query.execute();
    if (result.affected === 0) {
      this.logger.log(
        `[updateVaultOwnershipColumns] No row updated for vault ${vaultAddress} at block ${blockNumber} ` +
          `(onlyDisconnected=${!!opts.onlyDisconnected}): the vault is unknown, or a newer block was already applied`,
      );
    }
  }
}

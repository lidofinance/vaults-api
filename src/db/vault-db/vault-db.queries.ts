import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ReportEntity, ReportLeafEntity } from 'db/report-db/entities';
import { LABEL_TO_ROLE } from 'vault/vault.constants';

import { VaultStateEntity, VaultMemberEntity, VaultReportStatEntity } from './entities';
import { VAULT_APR_SMA_DAYS, SECONDS_PER_DAY, QUERY_METRICS_COMMENTS } from './vault-db.constants';

export type VaultsBaseQueryOpts = {
  includeDisconnected?: boolean;
  vaultAddress?: string;
  memberAddress?: string;
  memberRole?: string;
};

export function buildVaultsBaseQuery(manager: EntityManager, opts: VaultsBaseQueryOpts = {}): SelectQueryBuilder<any> {
  const { includeDisconnected = false, vaultAddress, memberAddress, memberRole } = opts;

  const qb = manager.getRepository(VaultStateEntity).createQueryBuilder('state').innerJoin('state.vault', 'vault');

  if (!includeDisconnected) {
    qb.where('vault.is_disconnected = false');
  }

  if (vaultAddress) {
    qb.andWhere('LOWER(vault.address) = LOWER(:vaultAddress)', {
      vaultAddress,
    });
  }

  // join ReportEntity and ReportLeafEntity (last report)
  qb.leftJoin(
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
  );

  // join VaultReportStat (Report Metrics)
  qb.leftJoin(
    (subQuery) =>
      subQuery
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
        .addOrderBy('report_stat.updated_at', 'DESC'), // get the latest data by 'report_stat.updated_at'
    'report_metrics',
    'report_metrics.vault_id = vault.id',
  );

  // join APR SMA
  qb.leftJoin(
    (subQuery) => {
      // 1) latest timestamp per vault
      const latest = subQuery
        .subQuery()
        .select('vs.vault_id', 'vault_id')
        .addSelect('MAX(r.timestamp)', 'latest_ts')
        .from(VaultReportStatEntity, 'vs')
        .innerJoin(ReportEntity, 'r', 'r.id = vs.current_report_id')
        .groupBy('vs.vault_id');

      // 2) avg over [from_ts; latest_ts] where from_ts is rounded down to 00:00 UTC
      return subQuery
        .select('vs2.vault_id', 'vault_id')
        .addSelect(`AVG(vs2.gross_staking_apr_percent)`, 'gross_staking_apr_sma')
        .addSelect(`AVG(vs2.net_staking_apr_percent)`, 'net_staking_apr_sma')
        .addSelect(`AVG(vs2.carry_spread_apr_percent)`, 'carry_spread_apr_sma')
        .from(VaultReportStatEntity, 'vs2')
        .innerJoin(ReportEntity, 'r2', 'r2.id = vs2.current_report_id')
        .innerJoin(latest.getQuery(), 'latest', `"latest"."vault_id" = vs2.vault_id`)
        .where(
          `
          r2.timestamp BETWEEN
            (
              (
                ("latest"."latest_ts" - :windowSeconds)
                - (("latest"."latest_ts" - :windowSeconds) % :secondsPerDay)
              )
            )
            AND "latest"."latest_ts"
        `,
        )
        .setParameters({
          windowSeconds: (VAULT_APR_SMA_DAYS - 1) * SECONDS_PER_DAY,
          secondsPerDay: SECONDS_PER_DAY,
        })
        .groupBy('vs2.vault_id');
    },
    'apr_sma',
    'apr_sma.vault_id = vault.id',
  );

  // join member filtering
  if (memberRole && memberAddress) {
    qb.innerJoin(
      VaultMemberEntity,
      'member',
      `"member"."vault_id" = "vault"."id"
       AND "member"."role" = :role
       AND LOWER("member"."address") = LOWER(:address)`,
      { role: LABEL_TO_ROLE[memberRole], address: memberAddress },
    );
  } else if (memberAddress) {
    qb.innerJoin(
      VaultMemberEntity,
      'member',
      `"member"."vault_id" = "vault"."id"
       AND LOWER("member"."address") = LOWER(:address)`,
      { address: memberAddress },
    );
  }

  qb.select([
    // vault
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

    // apr sma
    `apr_sma.gross_staking_apr_sma AS "grossStakingAprSma"`,
    `apr_sma.net_staking_apr_sma AS "netStakingAprSma"`,
    `apr_sma.carry_spread_apr_sma AS "carrySpreadAprSma"`,

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

  return qb;
}

export function buildFormattedVaultsQuery<T>(manager: EntityManager, qb: SelectQueryBuilder<T>) {
  // Format healthFactor after sorting is already applied
  return manager
    .createQueryBuilder()
    .select([
      '*',
      // `CASE` is PostgreSQL-specific!!!
      `CASE
        WHEN "healthFactor" = 'Infinity' THEN 'Infinity'
        ELSE "healthFactor"::text
      END AS "healthFactor"`,
    ])
    .from(`(${qb.getQuery()})`, 'vaults_formatted')
    .setParameters(qb.getParameters())
    .comment(
      // for metrics
      QUERY_METRICS_COMMENTS.GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_VAULTS,
    );
}

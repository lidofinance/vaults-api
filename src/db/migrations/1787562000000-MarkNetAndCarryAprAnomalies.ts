import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retro-flags rows the anomaly guard used to miss because it only looked at the gross APR.
 *
 * `Dashboard.voluntaryDisconnect()` parks `settledGrowth` at `type(int104).max` to stop node operator
 * fee accrual. The off-chain fee replica read that sentinel as an amount, so the report pair covering
 * the call priced the fee at ~5e29 wei — wrecking `net_staking_apr_percent` and
 * `carry_spread_apr_percent` while `gross_staking_apr_percent` stayed at 0 and kept `anomaly` false.
 * The calculation is fixed going forward; these rows are already stored and would otherwise skew the
 * 7-day SMA until they age out of the window, and stay visible in `/metrics-range` forever.
 *
 * The threshold is inlined rather than read from `APR_ANOMALY_THRESHOLD_PERCENT`: a migration records
 * the state at the time it was applied, and must not change meaning if that constant is retuned.
 */
export class MarkNetAndCarryAprAnomalies1787562000000 implements MigrationInterface {
  name = 'MarkNetAndCarryAprAnomalies1787562000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "vault_report_stats"
      SET "anomaly" = true
      WHERE "anomaly" = false
        AND (ABS("net_staking_apr_percent") >= 1000 OR ABS("carry_spread_apr_percent") >= 1000)
    `);
  }

  /** Exact inverse: clear only the rows the old gross-only guard would have left unflagged. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "vault_report_stats"
      SET "anomaly" = false
      WHERE "anomaly" = true
        AND ABS("gross_staking_apr_percent") < 1000
        AND (ABS("net_staking_apr_percent") >= 1000 OR ABS("carry_spread_apr_percent") >= 1000)
    `);
  }
}

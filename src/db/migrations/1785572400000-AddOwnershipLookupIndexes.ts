import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the lookups the ownership tracking introduced.
 *
 * - `vaults (LOWER(address))`: ownership writes match the vault case-insensitively, which the plain
 *   unique index on `address` cannot serve. Without this every write from the vaults cron (once per
 *   connected vault, hourly) and from the ownership cron (once per disconnected vault, every 10
 *   minutes) is a sequential scan of `vaults`.
 * - `vault_members (role, LOWER(address))`: the vaults list resolves "is this address a dashboard
 *   owner of this vault" with an `EXISTS` on role first, and the repair scan looks for vaults with no
 *   dashboard-owner row at all. The existing unique index is `(vault_id, address, role)`, so it is not
 *   a usable prefix for either.
 */
export class AddOwnershipLookupIndexes1785572400000 implements MigrationInterface {
  name = 'AddOwnershipLookupIndexes1785572400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_vaults_address_lower" ON "vaults" (LOWER("address"))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_vault_members_role_address_lower" ON "vault_members" ("role", LOWER("address"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vault_members_role_address_lower"`);
    await queryRunner.query(`DROP INDEX "IDX_vaults_address_lower"`);
  }
}

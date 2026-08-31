import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Monotonic guard for the `vault_members` provenance, mirroring `ownership_block_number`.
 *
 * Role members are written from three places reading different blocks — the daily members cron (safe
 * block), the `VaultConnected` handler (event block) and the ownership backfill — so a write from an
 * older block can land last and roll `members_owner_address` back to a previous owner.
 */
export class AddVaultMembersOwnerBlockNumber1785658800000 implements MigrationInterface {
  name = 'AddVaultMembersOwnerBlockNumber1785658800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vaults" ADD "members_owner_block_number" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vaults" DROP COLUMN "members_owner_block_number"`);
  }
}

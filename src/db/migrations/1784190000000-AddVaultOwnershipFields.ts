import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVaultOwnershipFields1784190000000 implements MigrationInterface {
  name = 'AddVaultOwnershipFields1784190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vaults" ADD "effective_owner_address" character varying(42)`);
    await queryRunner.query(`ALTER TABLE "vaults" ADD "members_owner_address" character varying(42)`);
    await queryRunner.query(`ALTER TABLE "vaults" ADD "ownership_block_number" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(
      `CREATE INDEX "IDX_vaults_effective_owner_address_lower" ON "vaults" (LOWER("effective_owner_address"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vaults_effective_owner_address_lower"`);
    await queryRunner.query(`ALTER TABLE "vaults" DROP COLUMN "ownership_block_number"`);
    await queryRunner.query(`ALTER TABLE "vaults" DROP COLUMN "members_owner_address"`);
    await queryRunner.query(`ALTER TABLE "vaults" DROP COLUMN "effective_owner_address"`);
  }
}

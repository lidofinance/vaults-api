import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuarantineFieldsToVaultStateTable1754559593285 implements MigrationInterface {
    name = 'AddQuarantineFieldsToVaultStateTable1754559593285'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "is_quarantine_active" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "quarantine_pending_total_value_increase" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "quarantine_start_timestamp" integer`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "quarantine_end_timestamp" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "quarantine_end_timestamp"`);
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "quarantine_start_timestamp"`);
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "quarantine_pending_total_value_increase"`);
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "is_quarantine_active"`);
    }

}

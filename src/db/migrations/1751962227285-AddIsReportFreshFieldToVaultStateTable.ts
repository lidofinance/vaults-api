import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsReportFreshFieldToVaultStateTable1751962227285 implements MigrationInterface {
    name = 'AddIsReportFreshFieldToVaultStateTable1751962227285'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_members" DROP CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4"`);
        await queryRunner.query(`ALTER TABLE "vault_states" DROP CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35"`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "is_report_fresh" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "vault_members" ADD CONSTRAINT "FK_cf7fd8a22f499f71b7ba4caae11" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD CONSTRAINT "FK_1e03a4b000bbe44dc4c2eb7c4b8" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" DROP CONSTRAINT "FK_1e03a4b000bbe44dc4c2eb7c4b8"`);
        await queryRunner.query(`ALTER TABLE "vault_members" DROP CONSTRAINT "FK_cf7fd8a22f499f71b7ba4caae11"`);
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "is_report_fresh"`);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vault_members" ADD CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}

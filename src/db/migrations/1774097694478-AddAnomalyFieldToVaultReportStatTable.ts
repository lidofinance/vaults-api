import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnomalyFieldToVaultReportStatTable1774097694478 implements MigrationInterface {
    name = 'AddAnomalyFieldToVaultReportStatTable1774097694478'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_report_stats" ADD "anomaly" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_report_stats" DROP COLUMN "anomaly"`);
    }

}

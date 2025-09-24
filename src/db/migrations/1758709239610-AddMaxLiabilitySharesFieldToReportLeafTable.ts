import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaxLiabilitySharesFieldToReportLeafTable1758709239610 implements MigrationInterface {
    name = 'AddMaxLiabilitySharesFieldToReportLeafTable1758709239610'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD "max_liability_shares" numeric(78,0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP COLUMN "max_liability_shares"`);
    }

}

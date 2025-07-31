import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewExtraDataFieldsToReportLeafTable1753265370962 implements MigrationInterface {
    name = 'AddNewExtraDataFieldsToReportLeafTable1753265370962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD "prev_fee" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD "infra_fee" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD "liquidity_fee" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD "reservation_fee" numeric(78,0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP COLUMN "reservation_fee"`);
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP COLUMN "liquidity_fee"`);
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP COLUMN "infra_fee"`);
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP COLUMN "prev_fee"`);
    }

}

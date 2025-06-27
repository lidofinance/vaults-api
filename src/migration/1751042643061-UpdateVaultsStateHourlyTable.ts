import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateVaultsStateHourlyTable1751042643061 implements MigrationInterface {
    name = 'UpdateVaultsStateHourlyTable1751042643061'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "gross_staking_rewards" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "node_operator_rewards" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "daily_lido_fees" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "net_staking_rewards" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "gross_apr" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "gross_apr_bps" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "gross_apr_percent" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "net_apr" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "net_apr_bps" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "net_apr_percent" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "bottom_line" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "efficiency_apr" numeric(78,0) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "efficiency_apr_bps" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD "efficiency_apr_percent" integer NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "efficiency_apr_percent"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "efficiency_apr_bps"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "efficiency_apr"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "bottom_line"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "net_apr_percent"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "net_apr_bps"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "net_apr"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "gross_apr_percent"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "gross_apr_bps"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "gross_apr"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "net_staking_rewards"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "daily_lido_fees"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "node_operator_rewards"`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP COLUMN "gross_staking_rewards"`);
    }

}

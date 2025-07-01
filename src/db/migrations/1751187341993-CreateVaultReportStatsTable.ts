import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultReportStatsTable1751187341993 implements MigrationInterface {
    name = 'CreateVaultReportStatsTable1751187341993'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_report_stats" ("id" SERIAL NOT NULL, "rebase_reward" double precision NOT NULL, "gross_staking_rewards" numeric(78,0) NOT NULL, "node_operator_rewards" numeric(78,0) NOT NULL, "daily_lido_fees" numeric(78,0) NOT NULL, "net_staking_rewards" numeric(78,0) NOT NULL, "gross_staking_apr" numeric(78,0) NOT NULL, "gross_staking_apr_bps" double precision NOT NULL, "gross_staking_apr_percent" double precision NOT NULL, "net_staking_apr" numeric(78,0) NOT NULL, "net_staking_apr_bps" double precision NOT NULL, "net_staking_apr_percent" double precision NOT NULL, "bottom_line" numeric(78,0) NOT NULL, "carry_spread_apr" numeric(78,0) NOT NULL, "carry_spread_apr_bps" double precision NOT NULL, "carry_spread_apr_percent" double precision NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "vault_id" integer NOT NULL, "current_report_id" integer NOT NULL, "previous_report_id" integer NOT NULL, CONSTRAINT "PK_05eebd72aafd54fa6c1e6b3ae42" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault_curReport_prevReport" ON "vault_report_stats" ("vault_id", "current_report_id", "previous_report_id") `);
        await queryRunner.query(`ALTER TABLE "vault_report_stats" ADD CONSTRAINT "FK_90423a47f74b83bdbe077a1e817" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vault_report_stats" ADD CONSTRAINT "FK_3a1b7d78e8e78c963f43808b06b" FOREIGN KEY ("current_report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vault_report_stats" ADD CONSTRAINT "FK_8cff52f2b2404619e1aac8d8ab4" FOREIGN KEY ("previous_report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_report_stats" DROP CONSTRAINT "FK_8cff52f2b2404619e1aac8d8ab4"`);
        await queryRunner.query(`ALTER TABLE "vault_report_stats" DROP CONSTRAINT "FK_3a1b7d78e8e78c963f43808b06b"`);
        await queryRunner.query(`ALTER TABLE "vault_report_stats" DROP CONSTRAINT "FK_90423a47f74b83bdbe077a1e817"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault_curReport_prevReport"`);
        await queryRunner.query(`DROP TABLE "vault_report_stats"`);
    }

}

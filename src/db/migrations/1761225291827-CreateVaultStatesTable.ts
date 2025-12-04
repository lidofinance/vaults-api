import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultStatesTable1761225291827 implements MigrationInterface {
    name = 'CreateVaultStatesTable1761225291827'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_states" ("id" SERIAL NOT NULL, "total_value" numeric(78,0) NOT NULL, "liability_steth" numeric(78,0) NOT NULL, "liability_shares" numeric(78,0) NOT NULL, "health_factor" double precision NOT NULL, "share_limit" numeric(78,0) NOT NULL, "reserve_ratio_bp" integer NOT NULL, "forced_rebalance_threshold_bp" integer NOT NULL, "infra_fee_bp" integer NOT NULL, "liquidity_fee_bp" integer NOT NULL, "reservation_fee_bp" integer NOT NULL, "node_operator_fee_rate" numeric(78,0) NOT NULL, "is_report_fresh" boolean NOT NULL DEFAULT false, "is_quarantine_active" boolean NOT NULL DEFAULT false, "quarantine_pending_total_value_increase" numeric(78,0) NOT NULL, "quarantine_start_timestamp" integer NOT NULL, "quarantine_end_timestamp" integer NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" integer NOT NULL, "vault_id" integer NOT NULL, CONSTRAINT "PK_6e351cc27a9c5d78e13b5b03297" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault" ON "vault_states" ("vault_id") `);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD CONSTRAINT "FK_1e03a4b000bbe44dc4c2eb7c4b8" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" DROP CONSTRAINT "FK_1e03a4b000bbe44dc4c2eb7c4b8"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault"`);
        await queryRunner.query(`DROP TABLE "vault_states"`);
    }

}

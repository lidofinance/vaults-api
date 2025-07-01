import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultStatesTable1750337524108 implements MigrationInterface {
    name = 'CreateVaultStatesTable1750337524108'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_states" ("id" SERIAL NOT NULL, "total_value" numeric(78,0) NOT NULL, "liability_steth" numeric(78,0) NOT NULL, "liability_shares" numeric(78,0) NOT NULL, "health_factor" double precision NOT NULL, "share_limit" numeric(78,0) NOT NULL, "reserve_ratio_bp" integer NOT NULL, "forced_rebalance_threshold_bp" integer NOT NULL, "infra_fee_bp" integer NOT NULL, "liquidity_fee_bp" integer NOT NULL, "reservation_fee_bp" integer NOT NULL, "node_operator_fee_rate" numeric(78,0) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" integer NOT NULL, "vault_id" integer NOT NULL, CONSTRAINT "PK_aecc2778cea023b085c37b05dd2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault" ON "vault_states" ("vault_id") `);
        await queryRunner.query(`ALTER TABLE "vault_states" ADD CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" DROP CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault"`);
        await queryRunner.query(`DROP TABLE "vault_states"`);
    }

}

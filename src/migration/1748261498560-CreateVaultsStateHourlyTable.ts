import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultsStateHourlyTable1748261498560 implements MigrationInterface {
    name = 'CreateVaultsStateHourlyTable1748261498560'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vaults_state_hourly" ("id" SERIAL NOT NULL, "total_value" numeric(78,0) NOT NULL, "steth_liability" numeric(78,0) NOT NULL, "shares_liability" numeric(78,0) NOT NULL, "health_factor" double precision NOT NULL, "forced_rebalance_threshold" numeric(78,0) NOT NULL, "lido_treasury_fee" numeric(78,0) NOT NULL, "node_operator_fee" numeric(78,0) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" integer NOT NULL, "vault_id" integer NOT NULL, CONSTRAINT "PK_aecc2778cea023b085c37b05dd2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" ADD CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaults_state_hourly" DROP CONSTRAINT "FK_ca88707b02a5ae2b1a72819ac35"`);
        await queryRunner.query(`DROP TABLE "vaults_state_hourly"`);
    }

}

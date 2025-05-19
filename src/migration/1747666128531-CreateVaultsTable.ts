import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultsTable1747666128531 implements MigrationInterface {
    name = 'CreateVaultsTable1747666128531'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "ens" character varying(255), "custom_name" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_35a94164f935280cf7fe9b13473" UNIQUE ("address"), CONSTRAINT "PK_dd0898234c77f9d97585171ac59" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vault"`);
    }

}

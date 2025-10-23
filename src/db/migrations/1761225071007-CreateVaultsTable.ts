import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultsTable1761225071007 implements MigrationInterface {
    name = 'CreateVaultsTable1761225071007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vaults" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "ens" character varying(255), "custom_name" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4831787c7e20a46f7fc3ed9ea18" UNIQUE ("address"), CONSTRAINT "PK_487a5346fa3693a430b6d6db60c" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vaults"`);
    }

}

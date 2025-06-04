import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultMemberTable1749044046230 implements MigrationInterface {
    name = 'CreateVaultMemberTable1749044046230'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_member" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "role" character varying(255) NOT NULL, "vault_id" integer NOT NULL, CONSTRAINT "PK_0202892cdf2e005081d5cb96817" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault_address" ON "vault_member" ("vault_id", "address") `);
        await queryRunner.query(`ALTER TABLE "vault_member" ADD CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_member" DROP CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault_address"`);
        await queryRunner.query(`DROP TABLE "vault_member"`);
    }

}

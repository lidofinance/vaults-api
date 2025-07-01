import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultMembersTable1749046938328 implements MigrationInterface {
    name = 'CreateVaultMembersTable1749046938328'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_members" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "role" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "vault_id" integer NOT NULL, CONSTRAINT "PK_0202892cdf2e005081d5cb96817" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault_address_role" ON "vault_members" ("vault_id", "address", "role") `);
        await queryRunner.query(`ALTER TABLE "vault_members" ADD CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_members" DROP CONSTRAINT "FK_33e4e43f2d0e99bf1d26e1581f4"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault_address_role"`);
        await queryRunner.query(`DROP TABLE "vault_members"`);
    }

}

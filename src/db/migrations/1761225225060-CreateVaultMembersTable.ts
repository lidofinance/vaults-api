import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVaultMembersTable1761225225060 implements MigrationInterface {
    name = 'CreateVaultMembersTable1761225225060'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_members" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "role" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "vault_id" integer NOT NULL, CONSTRAINT "PK_4b97098c5613f7e86dac59e4635" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uniq_vault_address_role" ON "vault_members" ("vault_id", "address", "role") `);
        await queryRunner.query(`ALTER TABLE "vault_members" ADD CONSTRAINT "FK_cf7fd8a22f499f71b7ba4caae11" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_members" DROP CONSTRAINT "FK_cf7fd8a22f499f71b7ba4caae11"`);
        await queryRunner.query(`DROP INDEX "public"."uniq_vault_address_role"`);
        await queryRunner.query(`DROP TABLE "vault_members"`);
    }

}

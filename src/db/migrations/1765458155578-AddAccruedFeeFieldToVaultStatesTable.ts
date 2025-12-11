import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccruedFeeFieldToVaultStatesTable1765458155578 implements MigrationInterface {
    name = 'AddAccruedFeeFieldToVaultStatesTable1765458155578'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" ADD "accrued_fee" numeric(78,0) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_states" DROP COLUMN "accrued_fee"`);
    }

}

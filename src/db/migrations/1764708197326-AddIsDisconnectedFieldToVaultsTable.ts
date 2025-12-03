import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsDisconnectedFieldToVaultsTable1764708197326 implements MigrationInterface {
    name = 'AddIsDisconnectedFieldToVaultsTable1764708197326'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaults" ADD "is_disconnected" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vaults" DROP COLUMN "is_disconnected"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeMerkleTreeRootNullableInReportTable1752056015067 implements MigrationInterface {
    name = 'MakeMerkleTreeRootNullableInReportTable1752056015067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "merkleTreeRoot" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "merkleTreeRoot" SET NOT NULL`);
    }

}

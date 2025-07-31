import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveMerkleTreeRootFromReportTable1753264633930 implements MigrationInterface {
    name = 'RemoveMerkleTreeRootFromReportTable1753264633930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_29ed9d48c6896717df7e5f788a"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "merkleTreeRoot"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reports" ADD "merkleTreeRoot" character varying(66)`);
        await queryRunner.query(`CREATE INDEX "IDX_29ed9d48c6896717df7e5f788a" ON "reports" ("merkleTreeRoot") `);
    }

}

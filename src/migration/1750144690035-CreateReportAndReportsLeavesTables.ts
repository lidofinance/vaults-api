import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReportAndReportsLeavesTables1750144690035 implements MigrationInterface {
    name = 'CreateReportAndReportsLeavesTables1750144690035'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "report_leaves" ("id" SERIAL NOT NULL, "vault_address" character varying(42) NOT NULL, "total_value_wei" numeric(78,0) NOT NULL, "in_out_delta" numeric(78,0) NOT NULL, "fee" numeric(78,0) NOT NULL, "liability_shares" numeric(78,0) NOT NULL, "tree_index" integer NOT NULL, "reportId" integer, CONSTRAINT "PK_3f812363c757395105b50b18e13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bc76332d2db8459cd8224d5575" ON "report_leaves" ("vault_address") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "unique_vault_per_report" ON "report_leaves" ("reportId", "vault_address") `);
        await queryRunner.query(`CREATE TABLE "reports" ("id" SERIAL NOT NULL, "cid" text NOT NULL, "merkleTreeRoot" character varying(66) NOT NULL, "refSlot" integer NOT NULL, "blockNumber" integer NOT NULL, "timestamp" integer NOT NULL, "proofs_cid" text NOT NULL, "prev_tree_cid" text, "tree" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d2d99f0fc881c10c1b7c6f811f1" UNIQUE ("cid"), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d2d99f0fc881c10c1b7c6f811f" ON "reports" ("cid") `);
        await queryRunner.query(`CREATE INDEX "IDX_29ed9d48c6896717df7e5f788a" ON "reports" ("merkleTreeRoot") `);
        await queryRunner.query(`ALTER TABLE "report_leaves" ADD CONSTRAINT "FK_c360d3d0778f8709cde94f4bb21" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_leaves" DROP CONSTRAINT "FK_c360d3d0778f8709cde94f4bb21"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29ed9d48c6896717df7e5f788a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d2d99f0fc881c10c1b7c6f811f"`);
        await queryRunner.query(`DROP TABLE "reports"`);
        await queryRunner.query(`DROP INDEX "public"."unique_vault_per_report"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc76332d2db8459cd8224d5575"`);
        await queryRunner.query(`DROP TABLE "report_leaves"`);
    }

}

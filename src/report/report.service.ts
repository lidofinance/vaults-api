import chunk from 'lodash.chunk';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ReportEntity } from './report.entity';
import { ReportLeafEntity } from './report-leaf.entity';

const LEAF_BATCH_SIZE = 500;

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepo: Repository<ReportEntity>,
    @InjectRepository(ReportLeafEntity)
    private readonly reportLeafRepo: Repository<ReportLeafEntity>,
  ) {}

  async saveReport(cid: string, reportData: any): Promise<ReportEntity> {
    const exists = await this.reportRepo.exist({ where: { cid } });
    if (exists) return this.reportRepo.findOneOrFail({ where: { cid } });

    const report = this.reportRepo.create({
      cid,
      merkleTreeRoot: reportData.merkleTreeRoot,
      refSlot: reportData.refSlot,
      blockNumber: reportData.blockNumber,
      timestamp: reportData.timestamp,
      proofsCID: reportData.proofsCID,
      prevTreeCID: reportData.prevTreeCID || null,
      tree: reportData.tree,
    });

    return await this.reportRepo.save(report);
  }

  async saveLeaves(report: ReportEntity, values: any[]): Promise<void> {
    if (!values || values.length === 0) return;

    const leafChunks = chunk(values, LEAF_BATCH_SIZE);

    for (const batch of leafChunks) {
      const leaves = batch.map((entry) =>
        this.reportLeafRepo.create({
          report,
          vaultAddress: entry.value[0],
          totalValueWei: BigInt(entry.value[1]).toString(),
          inOutDelta: BigInt(entry.value[2]).toString(),
          fee: BigInt(entry.value[3]).toString(),
          liabilityShares: BigInt(entry.value[4]).toString(),
          treeIndex: entry.treeIndex,
        }),
      );

      await this.reportLeafRepo.save(leaves);
    }
  }
}

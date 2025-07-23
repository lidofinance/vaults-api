import chunk from 'lodash.chunk';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Report } from '@lidofinance/lsv-cli/dist/utils';

import { ReportEntity, ReportLeafEntity } from './entities';

const LEAF_BATCH_SIZE = 500;

@Injectable()
export class ReportDbService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepo: Repository<ReportEntity>,
    @InjectRepository(ReportLeafEntity)
    private readonly reportLeafRepo: Repository<ReportLeafEntity>,
  ) {}

  async getAllReportsSortedDesc(skip = 0, take = 100): Promise<ReportEntity[]> {
    return this.reportRepo.find({
      order: { timestamp: 'DESC' },
      skip,
      take,
    });
  }

  async getLeavesByReport(report: ReportEntity): Promise<ReportLeafEntity[]> {
    return this.reportLeafRepo.find({ where: { report: { id: report.id } } });
  }

  async saveReport(cid: string, reportData: Report): Promise<ReportEntity> {
    const exists = await this.reportRepo.exist({ where: { cid } });
    if (exists) return this.reportRepo.findOneOrFail({ where: { cid } });

    const report = this.reportRepo.create({
      cid,
      refSlot: reportData.refSlot,
      // Safe: blockNumber is within Number.MAX_SAFE_INTEGER
      blockNumber: Number(reportData.blockNumber),
      timestamp: reportData.timestamp,
      prevTreeCID: reportData.prevTreeCID || null,
      tree: reportData.tree,
    });

    return await this.reportRepo.save(report);
  }

  async saveLeaves(report: ReportEntity, reportData: Report): Promise<void> {
    // reportData is json (see example: https://ipfs.io/ipfs/QmPCBnLZzQsaUgzLfhTxiQTU8nRe3siG29feWYEQN2e5W1)
    const values = reportData?.values;
    const extraValues = reportData?.extraValues;

    // TODO: remove lodash
    const leafChunks = chunk(values, LEAF_BATCH_SIZE);

    for (const batch of leafChunks) {
      const leaves = batch.map((entry: any) => {
        const [vaultAddress, totalValueWei, fee, liabilityShares, slashingReserve] = entry.value;

        const treeIndex = entry.treeIndex;
        const inOutDelta = extraValues?.[vaultAddress]?.inOutDelta ?? '0';
        // TODO: add new extra data

        return this.reportLeafRepo.create({
          report,
          vaultAddress,
          totalValueWei: BigInt(totalValueWei).toString(),
          inOutDelta: BigInt(inOutDelta).toString(),
          fee: BigInt(fee).toString(),
          liabilityShares: BigInt(liabilityShares).toString(),
          slashingReserve: BigInt(slashingReserve).toString(),
          treeIndex,
        });
      });

      await this.reportLeafRepo.upsert(leaves, ['report', 'vaultAddress']);
    }
  }
}

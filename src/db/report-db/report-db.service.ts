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

  async existsByCid(cid: string): Promise<boolean> {
    return this.reportRepo.exist({ where: { cid } });
  }

  async findByCid(cid: string): Promise<ReportEntity | null> {
    const normalizedCid = cid?.trim();
    if (!normalizedCid) return null;
    return this.reportRepo.findOne({ where: { cid: normalizedCid } });
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
        const prevFee = extraValues?.[vaultAddress]?.prevFee ?? '0';
        const infraFee = extraValues?.[vaultAddress]?.infraFee ?? '0';
        const liquidityFee = extraValues?.[vaultAddress]?.liquidityFee ?? '0';
        const reservationFee = extraValues?.[vaultAddress]?.reservationFee ?? '0';

        return this.reportLeafRepo.create({
          report,
          vaultAddress,
          totalValueWei,
          inOutDelta,
          prevFee,
          infraFee,
          liquidityFee,
          reservationFee,
          fee,
          liabilityShares,
          slashingReserve,
          treeIndex,
        });
      });

      await this.reportLeafRepo.upsert(leaves, ['report', 'vaultAddress']);
    }
  }
}

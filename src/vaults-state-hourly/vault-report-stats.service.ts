import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VaultReportStatsEntity } from './vault-report-stats.entity';

@Injectable()
export class VaultReportStatsService {
  constructor(
    @InjectRepository(VaultReportStatsEntity)
    private readonly repo: Repository<VaultReportStatsEntity>,
  ) {}

  async addOrUpdate(entry: Partial<VaultReportStatsEntity>): Promise<void> {
    await this.repo.upsert(entry, {
      conflictPaths: ['vault', 'currentReport', 'previousReport'],
      skipUpdateIfNoValuesChanged: false,
    });
  }
}

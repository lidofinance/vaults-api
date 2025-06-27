import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';

@Injectable()
export class VaultsStateHourlyService {
  constructor(
    @InjectRepository(VaultsStateHourlyEntity)
    private readonly repo: Repository<VaultsStateHourlyEntity>,
  ) {}

  async getByVaultAddress(vaultAddress: string): Promise<VaultsStateHourlyEntity | null> {
    return this.repo
      .createQueryBuilder('state')
      .leftJoinAndSelect('state.vault', 'vault')
      .where('vault.address = :vaultAddress', { vaultAddress })
      .getOne();
  }

  async addOrUpdate(entry: Partial<VaultsStateHourlyEntity>): Promise<void> {
    await this.repo.upsert(entry, {
      conflictPaths: ['vault'],
      skipUpdateIfNoValuesChanged: false,
    });
  }
}

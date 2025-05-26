import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';

@Injectable()
export class VaultsStateHourlyService {
  constructor(
    @InjectRepository(VaultsStateHourlyEntity)
    private readonly repo: Repository<VaultsStateHourlyEntity>,
  ) {}

  async add(entry: Partial<VaultsStateHourlyEntity>): Promise<VaultsStateHourlyEntity> {
    const created = this.repo.create(entry);
    return await this.repo.save(created);
  }

  async getLastByVaultAddress(address: string): Promise<VaultsStateHourlyEntity | null> {
    return await this.repo.findOne({
      where: {
        vault: { address },
      },
      relations: ['vault'],
      order: { updatedAt: 'DESC' },
    });
  }
}

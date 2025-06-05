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

  async addOrUpdate(entry: Partial<VaultsStateHourlyEntity>): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(VaultsStateHourlyEntity)
      .values(entry)
      .orUpdate({
        conflict_target: ['vault_id'],
        overwrite: [
          'total_value',
          'steth_liability',
          'shares_liability',
          'health_factor',
          'forced_rebalance_threshold',
          'lido_treasury_fee',
          'node_operator_fee',
          'block_number',
          'updated_at',
        ],
      })
      .execute();
  }
}

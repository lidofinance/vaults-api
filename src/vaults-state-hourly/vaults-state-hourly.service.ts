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
          'liability_steth',
          'liability_shares',
          'health_factor',
          'share_limit',
          'reserve_ratio_bp',
          'forced_rebalance_threshold_bp',
          'infra_fee_bp',
          'liquidity_fee_bp',
          'reservation_fee_bp',
          'node_operator_fee_rate',
          'block_number',
          'updated_at',
        ],
      })
      .execute();
  }
}

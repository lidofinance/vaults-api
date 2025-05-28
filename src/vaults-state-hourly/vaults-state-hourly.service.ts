import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';

export type VaultLatestStateDto = {
  address: string;
  ens: string | null;
  customName: string | null;
  totalValue: string;
  stEthLiability: string;
  healthFactor: number;
  updatedAt: Date;
};

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

  async getLastByVaultAddress(address: string): Promise<VaultsStateHourlyEntity | null> {
    return await this.repo.findOne({
      where: {
        vault: { address },
      },
      relations: ['vault'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getLastByVaultAddresses(addresses: string[]): Promise<Array<VaultLatestStateDto>> {
    return await this.repo
      .createQueryBuilder('state')
      .innerJoin('state.vault', 'vault')
      .select([
        `vault.address AS "address"`,
        `vault.ens AS "ens"`,
        `vault.custom_name AS "customName"`,
        `state.total_value AS "totalValue"`,
        `state.steth_liability AS "stEthLiability"`,
        `state.health_factor AS "healthFactor"`,
        `state.updated_at AS "updatedAt"`,
      ])
      .where('vault.address IN (:...addresses)', { addresses })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(sub.updated_at)', 'max_updated_at')
          .addSelect('sub.vault_id', 'vault_id')
          .from(VaultsStateHourlyEntity, 'sub')
          .groupBy('sub.vault_id')
          .getQuery();
        return `("state"."updated_at", "state"."vault_id") IN (${subQuery})`;
      })
      .getRawMany();
  }
}

import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { VaultsStateHourlyEntity } from './vaults-state-hourly.entity';
import { SortFields } from './sort-fields.enum';
import { Direction, DirectionEnum } from './direction.enum';

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

  async getVaultsSorted(
    limit: number,
    offset: number,
    sortBy: SortFields,
    direction: Direction = DirectionEnum.ASC,
  ): Promise<
    Array<{
      address: string;
      ens: string | null;
      customName: string | null;
      totalValue: string;
      stEthLiability: string;
      // sharesLiability: string;
      healthFactor: number;
      // forcedRebalanceThreshold: string;
      // lidoTreasuryFee: string;
      // nodeOperatorFee: string;
      updatedAt: Date;
      blockNumber: number;
    }>
  > {
    // Since the vaults_state_hourly table has exactly one row per vault_id,
    // we can select everything, sort by the field, and apply limit, offset
    const qb = this.repo
      .createQueryBuilder('state')
      .innerJoin('state.vault', 'vault')
      .select([
        `vault.address AS "address"`,
        `vault.ens AS "ens"`,
        `vault.custom_name AS "customName"`,
        `state.total_value AS "totalValue"`,
        `state.steth_liability AS "stEthLiability"`,
        // `state.shares_liability AS "sharesLiability"`,
        // TODO: state.health_factor === Infinity ? 'Infinity' : state.health_factor,
        `state.health_factor AS "healthFactor"`,
        // `state.forced_rebalance_threshold AS "forcedRebalanceThreshold"`,
        // `state.lido_treasury_fee AS "lidoTreasuryFee"`,
        // `state.node_operator_fee AS "nodeOperatorFee"`,
        `state.updated_at AS "updatedAt"`,
        `state.block_number AS "blockNumber"`,
      ])
      // The field in the database is named in snake_case, in TypeScript it is camelCase
      // TODO: state.health_factor === Infinity ? 'Infinity' : state.health_factor,
      .orderBy(`state."${this.toSnakeCaseColumn(sortBy)}"`, direction)
      .limit(limit)
      .offset(offset);

    const rawResult = await qb.getRawMany<{
      address: string;
      ens: string | null;
      customName: string | null;
      totalValue: string;
      stEthLiability: string;
      // sharesLiability: string;
      healthFactor: number;
      // forcedRebalanceThreshold: string;
      // lidoTreasuryFee: string;
      // nodeOperatorFee: string;
      updatedAt: Date;
      blockNumber: number;
    }>();

    return rawResult;
  }

  private toSnakeCaseColumn(field: SortFields): string {
    // The field in the database is named in snake_case, in TypeScript it is camelCase
    switch (field) {
      case 'totalValue':
        return 'total_value';
      case 'stEthLiability':
        return 'steth_liability';
      // case 'sharesLiability':
      //   return 'shares_liability';
      case 'healthFactor':
        return 'health_factor';
      // case 'forcedRebalanceThreshold':
      //   return 'forced_rebalance_threshold';
      // case 'lidoTreasuryFee':
      //   return 'lido_treasury_fee';
      // case 'nodeOperatorFee':
      //   return 'node_operator_fee';
      case 'blockNumber':
        return 'block_number';
      default:
        return field as string;
    }
  }
}

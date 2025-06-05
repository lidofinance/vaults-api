import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { VaultsStateHourlyEntity } from 'vaults-state-hourly/vaults-state-hourly.entity';
import { VaultMemberEntity } from 'vault-member/vault-member.entity';

import { SortFields } from './sort-fields.enum';
import { Direction, DirectionEnum } from './direction.enum';

@Injectable()
export class VaultsQueryService {
  constructor(
    @InjectRepository(VaultsStateHourlyEntity)
    private readonly repo: Repository<VaultsStateHourlyEntity>,
  ) {}

  async getVaults(
    limit: number,
    offset: number,
    sortBy: SortFields,
    direction: Direction = DirectionEnum.ASC,
    role?: string,
    address?: string,
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
        // Only PostgreSQL!!!
        `CASE
          WHEN state.health_factor = 'Infinity' THEN 'Infinity'
          ELSE state.health_factor::text
        END AS "healthFactor"`,
        // `state.forced_rebalance_threshold AS "forcedRebalanceThreshold"`,
        // `state.lido_treasury_fee AS "lidoTreasuryFee"`,
        // `state.node_operator_fee AS "nodeOperatorFee"`,
        `state.updated_at AS "updatedAt"`,
        `state.block_number AS "blockNumber"`,
      ]);

    if (role && address) {
      qb.innerJoin(
        VaultMemberEntity,
        'member',
        `"member"."vault_id" = "vault"."id"
         AND "member"."role" = :role
         AND "member"."address" = :address`,
        { role, address },
      );
    }

    // Sort by field: The field in the database is named in snake_case, in TypeScript it is camelCase
    qb.orderBy(`state."${this.toSnakeCaseColumn(sortBy)}"`, direction)
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

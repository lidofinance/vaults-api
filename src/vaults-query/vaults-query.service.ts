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
      liabilityStETH: string;
      liabilityShares: string;
      healthFactor: number;
      shareLimit: string;
      reserveRatioBP: number;
      forcedRebalanceThresholdBP: number;
      infraFeeBP: number;
      liquidityFeeBP: number;
      reservationFeeBP: number;
      nodeOperatorFeeRate: string;
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
        `state.liability_steth AS "liabilityStETH"`,
        `state.liability_shares AS "liabilityShares"`,
        // Only PostgreSQL!!!
        `CASE
          WHEN state.health_factor = 'Infinity' THEN 'Infinity'
          ELSE state.health_factor::text
        END AS "healthFactor"`,
        `state.share_limit AS "shareLimit"`,
        `state.reserve_ratio_bp AS "reserveRatioBP"`,
        `state.forced_rebalance_threshold_bp AS "forcedRebalanceThresholdBP"`,
        `state.infra_fee_bp AS "infraFeeBP"`,
        `state.liquidity_fee_bp AS "liquidityFeeBP"`,
        `state.reservation_fee_bp AS "reservationFeeBP"`,
        `state.node_operator_fee_rate AS "nodeOperatorFeeRate"`,
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
      liabilityStETH: string;
      liabilityShares: string;
      healthFactor: number;
      shareLimit: string;
      reserveRatioBP: number;
      forcedRebalanceThresholdBP: number;
      infraFeeBP: number;
      liquidityFeeBP: number;
      reservationFeeBP: number;
      nodeOperatorFeeRate: string;
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
      case 'liabilityStETH':
        return 'liability_steth';
      case 'liabilityShares':
        return 'liability_shares';
      case 'healthFactor':
        return 'health_factor';
      // case 'forcedRebalanceThresholdBP':
      //   return 'forced_rebalance_threshold_bp';
      case 'blockNumber':
        return 'block_number';
      default:
        return field as string;
    }
  }
}

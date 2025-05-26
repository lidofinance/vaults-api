import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { VaultEntity } from '../vault';

@Entity('vaults_state_hourly')
export class VaultsStateHourlyEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @ManyToOne(() => VaultEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vault_id' })
  vault: VaultEntity;

  @Column({ name: 'total_value', type: 'numeric', precision: 78, scale: 0 })
  // TODO
  // during deserialization from 'plain' to 'class'
  // @Transform(({ value }) => value !== null ? BigInt(value) : null, { toClassOnly: true })
  // during serialization from 'class' to 'plain'
  // @Transform(({ value }) => value !== null ? value.toString() : null, { toPlainOnly: true })
  totalValue: string; // bigint/numeric

  @Column({ name: 'steth_liability', type: 'numeric', precision: 78, scale: 0 })
  stEthLiability: string;

  @Column({ name: 'shares_liability', type: 'numeric', precision: 78, scale: 0 })
  sharesLiability: string;

  @Column({ name: 'health_factor', type: 'float8' })
  healthFactor: number; // float8, ±Infinity support

  @Column({ name: 'forced_rebalance_threshold', type: 'numeric', precision: 78, scale: 0 })
  forcedRebalanceThreshold: string;

  @Column({ name: 'lido_treasury_fee', type: 'numeric', precision: 78, scale: 0 })
  lidoTreasuryFee: string;

  @Column({ name: 'node_operator_fee', type: 'numeric', precision: 78, scale: 0 })
  nodeOperatorFee: string;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber: string; // uint64 → bigint
}

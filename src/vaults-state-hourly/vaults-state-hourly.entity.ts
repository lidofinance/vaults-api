import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { VaultEntity } from '../vault';

@Entity('vaults_state_hourly')
@Index('uniq_vault', ['vault'], { unique: true })
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

  @Column({ name: 'liability_steth', type: 'numeric', precision: 78, scale: 0 })
  liabilityStETH: string;

  @Column({ name: 'liability_shares', type: 'numeric', precision: 78, scale: 0 })
  liabilityShares: string;

  @Column({ name: 'health_factor', type: 'float8' })
  healthFactor: number; // float8, ±Infinity support

  @Column({ name: 'share_limit', type: 'numeric', precision: 78, scale: 0 })
  shareLimit: string;

  @Column({ name: 'reserve_ratio_bp', type: 'integer' })
  reserveRatioBP: string;

  @Column({ name: 'forced_rebalance_threshold_bp', type: 'integer' })
  forcedRebalanceThresholdBP: string;

  @Column({ name: 'infra_fee_bp', type: 'integer' })
  infraFeeBP: string;

  @Column({ name: 'liquidity_fee_bp', type: 'integer' })
  liquidityFeeBP: string;

  @Column({ name: 'reservation_fee_bp', type: 'integer' })
  reservationFeeBP: string;

  @Column({ name: 'node_operator_fee_rate', type: 'numeric', precision: 78, scale: 0 })
  nodeOperatorFeeRate: string;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'block_number', type: 'integer' })
  blockNumber: number;
}

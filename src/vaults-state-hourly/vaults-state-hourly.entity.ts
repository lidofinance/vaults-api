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
  totalValue: string;

  @Column({ name: 'liability_steth', type: 'numeric', precision: 78, scale: 0 })
  liabilityStETH: string;

  @Column({ name: 'liability_shares', type: 'numeric', precision: 78, scale: 0 })
  liabilityShares: string;

  @Column({ name: 'health_factor', type: 'float8' })
  healthFactor: number;

  @Column({ name: 'share_limit', type: 'numeric', precision: 78, scale: 0 })
  shareLimit: string;

  @Column({ name: 'reserve_ratio_bp', type: 'integer' })
  reserveRatioBP: number;

  @Column({ name: 'forced_rebalance_threshold_bp', type: 'integer' })
  forcedRebalanceThresholdBP: number;

  @Column({ name: 'infra_fee_bp', type: 'integer' })
  infraFeeBP: number;

  @Column({ name: 'liquidity_fee_bp', type: 'integer' })
  liquidityFeeBP: number;

  @Column({ name: 'reservation_fee_bp', type: 'integer' })
  reservationFeeBP: number;

  @Column({ name: 'node_operator_fee_rate', type: 'numeric', precision: 78, scale: 0 })
  nodeOperatorFeeRate: string;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'block_number', type: 'integer' })
  blockNumber: number;
}

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

  @Column({ name: 'gross_staking_rewards', type: 'numeric', precision: 78, scale: 0, nullable: true })
  grossStakingRewards?: string;

  @Column({ name: 'node_operator_rewards', type: 'numeric', precision: 78, scale: 0, nullable: true })
  nodeOperatorRewards?: string;

  @Column({ name: 'daily_lido_fees', type: 'numeric', precision: 78, scale: 0, nullable: true })
  dailyLidoFees?: string;

  @Column({ name: 'net_staking_rewards', type: 'numeric', precision: 78, scale: 0, nullable: true })
  netStakingRewards?: string;

  @Column({ name: 'gross_staking_apr', type: 'numeric', precision: 78, scale: 0, nullable: true })
  grossStakingAPR?: string;

  @Column({ name: 'gross_staking_apr_bps', type: 'integer', nullable: true })
  grossStakingAprBps?: number;

  @Column({ name: 'gross_staking_apr_percent', type: 'integer', nullable: true })
  grossStakingAprPercent?: number;

  @Column({ name: 'net_staking_apr', type: 'numeric', precision: 78, scale: 0, nullable: true })
  netStakingAPR?: string;

  @Column({ name: 'net_staking_apr_bps', type: 'integer', nullable: true })
  netStakingAprBps?: number;

  @Column({ name: 'net_staking_apr_percent', type: 'integer', nullable: true })
  netStakingAprPercent?: number;

  @Column({ name: 'bottom_line', type: 'numeric', precision: 78, scale: 0, nullable: true })
  bottomLine?: string;

  @Column({ name: 'efficiency_apr', type: 'numeric', precision: 78, scale: 0, nullable: true })
  efficiencyAPR?: string;

  @Column({ name: 'efficiency_apr_bps', type: 'integer', nullable: true })
  efficiencyAprBps?: number;

  @Column({ name: 'efficiency_apr_percent', type: 'integer', nullable: true })
  efficiencyAprPercent?: number;
}

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ReportEntity } from 'report';
import { VaultEntity } from '../vault';

@Entity('vault_report_stats')
@Index('uniq_vault_curReport_prevReport', ['vault', 'currentReport', 'previousReport'], { unique: true })
export class VaultReportStatsEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @ManyToOne(() => VaultEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vault_id' })
  vault: VaultEntity;

  @ManyToOne(() => ReportEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'current_report_id' })
  currentReport: ReportEntity;

  @ManyToOne(() => ReportEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'previous_report_id' })
  previousReport: ReportEntity;

  @Column({ name: 'rebase_reward', type: 'float8' })
  rebaseReward?: string;

  @Column({ name: 'gross_staking_rewards', type: 'numeric', precision: 78, scale: 0 })
  grossStakingRewards?: string;

  @Column({ name: 'node_operator_rewards', type: 'numeric', precision: 78, scale: 0 })
  nodeOperatorRewards?: string;

  @Column({ name: 'daily_lido_fees', type: 'numeric', precision: 78, scale: 0 })
  dailyLidoFees?: string;

  @Column({ name: 'net_staking_rewards', type: 'numeric', precision: 78, scale: 0 })
  netStakingRewards?: string;

  @Column({ name: 'gross_staking_apr', type: 'numeric', precision: 78, scale: 0 })
  grossStakingAPR?: string;

  @Column({ name: 'gross_staking_apr_bps', type: 'float8' })
  grossStakingAprBps?: number;

  @Column({ name: 'gross_staking_apr_percent', type: 'float8' })
  grossStakingAprPercent?: number;

  @Column({ name: 'net_staking_apr', type: 'numeric', precision: 78, scale: 0 })
  netStakingAPR?: string;

  @Column({ name: 'net_staking_apr_bps', type: 'float8' })
  netStakingAprBps?: number;

  @Column({ name: 'net_staking_apr_percent', type: 'float8' })
  netStakingAprPercent?: number;

  @Column({ name: 'bottom_line', type: 'numeric', precision: 78, scale: 0 })
  bottomLine?: string;

  @Column({ name: 'efficiency_apr', type: 'numeric', precision: 78, scale: 0 })
  efficiencyAPR?: string;

  @Column({ name: 'efficiency_apr_bps', type: 'float8' })
  efficiencyAprBps?: number;

  @Column({ name: 'efficiency_apr_percent', type: 'float8' })
  efficiencyAprPercent?: number;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

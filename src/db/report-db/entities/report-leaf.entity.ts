import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { ReportEntity } from './report.entity';

@Entity({ name: 'report_leaves' })
@Index('unique_vault_per_report', ['report', 'vaultAddress'], { unique: true })
export class ReportLeafEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 42, name: 'vault_address' })
  vaultAddress: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'total_value_wei' })
  totalValueWei: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'in_out_delta' })
  inOutDelta: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'prev_fee', nullable: true })
  prevFee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'infra_fee', nullable: true })
  infraFee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'liquidity_fee', nullable: true })
  liquidityFee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'reservation_fee', nullable: true })
  reservationFee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'fee' })
  fee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'liability_shares' })
  liabilityShares: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'max_liability_shares', nullable: true })
  maxLiabilityShares: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'slashing_reserve' })
  slashingReserve: string;

  @Column({ type: 'int', name: 'tree_index' })
  treeIndex: number;

  @ManyToOne(() => ReportEntity, (report) => report.leaves, {
    onDelete: 'CASCADE',
  })
  report: ReportEntity;
}

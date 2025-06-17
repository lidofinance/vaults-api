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

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'fee' })
  fee: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, name: 'liability_shares' })
  liabilityShares: string;

  @Column({ type: 'int', name: 'tree_index' })
  treeIndex: number;

  @ManyToOne(() => ReportEntity, (report) => report.leaves, {
    onDelete: 'CASCADE',
  })
  report: ReportEntity;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { ReportLeafEntity } from './report-leaf.entity';

@Entity({ name: 'reports' })
export class ReportEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ type: 'text', unique: true })
  cid: string;

  @Column({ type: 'int' })
  refSlot: number;

  @Column({ type: 'int' })
  blockNumber: number;

  @Column({ type: 'int' })
  timestamp: number;

  @Column({ type: 'text', name: 'prev_tree_cid', nullable: true })
  prevTreeCID: string | null;

  @Column({ type: 'jsonb' })
  tree: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ReportLeafEntity, (leaf) => leaf.report, { cascade: true })
  leaves: ReportLeafEntity[];
}

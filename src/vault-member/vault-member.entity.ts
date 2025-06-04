import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { VaultEntity } from '../vault';

@Entity('vault_member')
@Index('uniq_vault_address_role', ['vault', 'address', 'role'], { unique: true })
export class VaultMemberEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @ManyToOne(() => VaultEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vault_id' })
  vault: VaultEntity;

  @Column({ type: 'varchar', length: 42 })
  address: string;

  @Column({ type: 'varchar', length: 255 })
  role: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

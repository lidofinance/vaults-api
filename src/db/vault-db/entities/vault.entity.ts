import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vaults')
export class VaultEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 42, unique: true })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ens: string | null;

  @Column({ name: 'custom_name', type: 'varchar', length: 255, nullable: true })
  customName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

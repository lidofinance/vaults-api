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

  @Column({ name: 'is_disconnected', type: 'boolean', default: false })
  isDisconnected: boolean;

  /**
   * The address a user would recognise as the vault owner:
   * - while connected — `VaultHub` connection owner (`connection.owner`, usually the Dashboard),
   *   because `StakingVault.owner()` is the `VaultHub` itself;
   * - after a disconnect — `StakingVault.owner()`, or `pendingOwner()` while the ownership
   *   handover back from the `VaultHub` has not been accepted yet (`StakingVault` is Ownable2Step).
   */
  @Column({ name: 'effective_owner_address', type: 'varchar', length: 42, nullable: true })
  effectiveOwnerAddress: string | null;

  /**
   * The owner the `vault_members` rows were last read through (`VaultViewer` resolves roles via the
   * vault owner, so it is the owner that answered for them). Compared against
   * `effectiveOwnerAddress` to tell whether those role members still control the vault: once the
   * vault is transferred to another address, the recorded roles stop being authoritative.
   */
  @Column({ name: 'members_owner_address', type: 'varchar', length: 42, nullable: true })
  membersOwnerAddress: string | null;

  /** Block of the last applied ownership/connection update, guards against out-of-order writes. */
  @Column({ name: 'ownership_block_number', type: 'integer', default: 0 })
  ownershipBlockNumber: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

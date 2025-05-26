import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VaultEntity } from './vault.entity';

@Injectable()
export class VaultsService {
  constructor(
    @InjectRepository(VaultEntity)
    private readonly vaultRepo: Repository<VaultEntity>,
  ) {}

  async addVault(address: string): Promise<VaultEntity> {
    const existing = await this.vaultRepo.findOne({ where: { address } });
    if (existing) {
      throw new ConflictException(`Vault with address ${address} already exists`);
    }

    const vault = this.vaultRepo.create({ address });
    return await this.vaultRepo.save(vault);
  }

  async updateEns(address: string, ens: string): Promise<VaultEntity> {
    const vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      throw new NotFoundException(`Vault with address ${address} not found`);
    }

    vault.ens = ens;
    return await this.vaultRepo.save(vault);
  }

  async updateCustomName(address: string, customName: string): Promise<VaultEntity> {
    const vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      throw new NotFoundException(`Vault with address ${address} not found`);
    }

    vault.customName = customName;
    return await this.vaultRepo.save(vault);
  }

  async getVaults(limit = 10, offset = 0): Promise<VaultEntity[]> {
    return await this.vaultRepo.find({
      take: limit,
      skip: offset,
      // ASC (ascending order) - 1 → 2 → 3 → 4 → ...
      order: { id: 'ASC' },
    });
  }

  async getVaultByAddress(address: string): Promise<VaultEntity> {
    const vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      throw new NotFoundException(`Vault with address ${address} not found`);
    }
    return vault;
  }
}

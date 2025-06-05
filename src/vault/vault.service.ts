import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VaultEntity } from './vault.entity';

@Injectable()
export class VaultsService {
  constructor(
    @InjectRepository(VaultEntity)
    private readonly vaultRepo: Repository<VaultEntity>,
  ) {}

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

  async getVaultsCount(): Promise<number> {
    return await this.vaultRepo.count();
  }

  async getOrCreateVaultByAddress(address: string): Promise<VaultEntity> {
    let vault = await this.vaultRepo.findOne({ where: { address } });
    if (!vault) {
      vault = this.vaultRepo.create({ address });
      vault = await this.vaultRepo.save(vault);
    }
    return vault;
  }
}

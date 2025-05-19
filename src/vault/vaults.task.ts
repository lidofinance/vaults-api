// import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { VaultsService } from './vaults.service';
//
// @Injectable()
// export class VaultsTask {
//   private readonly logger = new Logger(VaultsCron.name);
//
//   constructor(private readonly vaultsService: VaultsService) {}
//
//   // запускается каждую минуту (можно поменять)
//   @Cron(CronExpression.EVERY_MINUTE)
//   async handleVaultSync() {
//     this.logger.log('Starting vault batch insert');
//
//     const vaultAddresses: string[] = await this.getVaultsFromSource();
//
//     for (const address of vaultAddresses) {
//       try {
//         await this.vaultsService.addVault(address);
//       } catch (err) {
//         if (err instanceof Error && err.name === 'ConflictException') {
//           // уже существует — это не ошибка
//           this.logger.debug(`Vault ${address} already exists`);
//         } else {
//           this.logger.error(`Failed to add vault ${address}`, err.stack);
//         }
//       }
//     }
//
//     this.logger.log(`Inserted batch: ${vaultAddresses.length} vaults`);
//   }
//
//   // ⚠️ замени эту заглушку реальными данными
//   private async getVaultsFromSource(): Promise<string[]> {
//     return [
//       '0x1111111111111111111111111111111111111111',
//       '0x2222222222222222222222222222222222222222',
//       // ...
//     ];
//   }
// }

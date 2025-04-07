import { LidoContractModule, LidoLocatorContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '../config';

@Global()
@Module({
  imports: [LidoContractModule, LidoLocatorContractModule].map((module) =>
    module.forRootAsync({
      async useFactory(config: ConfigService) {
        const addressMap = await config.getCustomConfigContractsAddressMap();
        const address = addressMap ? addressMap.get(module.contractToken) : undefined;
        return { address };
      },
      inject: [ConfigService],
    }),
  ),
})
export class ContractsModule {}

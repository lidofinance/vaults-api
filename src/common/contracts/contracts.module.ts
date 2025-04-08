import { LidoContractModule, LidoLocatorContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { getDefaultProvider } from '@ethersproject/providers';
import { ConfigService } from '../config';

@Global()
@Module({
  imports: [LidoContractModule, LidoLocatorContractModule].map((module) =>
    module.forRootAsync({
      async useFactory(config: ConfigService) {
        // TODO: provider will be changed later (this one is used for testing only PoC)
        const provider = getDefaultProvider('mainnet');

        const addressMap = await config.getCustomConfigContractsAddressMap();
        const address = addressMap ? addressMap.get(module.contractToken) : undefined;
        return { provider, address };
      },
      inject: [ConfigService],
    }),
  ),
})
export class ContractsModule {}

import { Module } from '@nestjs/common';
import { LIDO_LOCATOR_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { Contract } from 'ethers';
import { ExecutionProvider } from 'common/execution-provider';
import { LidoContractService } from './lido-contract.service';
import { LidoLocatorAbi } from '../../abi/LidoLocator';

@Module({
  providers: [
    {
      provide: LidoContractService,
      useFactory: async (locatorContract: Contract, provider: ExecutionProvider) => {
        // TODO:
        //  it will fall if you don't override the contract set (CUSTOM_NETWORK_FILE_NAME),
        //  because the original hoodi locator contract does not have lazyOracle field
        //
        // The 'locatorContract.address' takes into account the override via the CUSTOM_NETWORK_FILE_NAME env
        const locatorContractWithVaultHub = new Contract(locatorContract.address, LidoLocatorAbi, provider);
        const lidoAddress = await locatorContractWithVaultHub.lido();

        return new LidoContractService(provider, lidoAddress);
      },
      inject: [LIDO_LOCATOR_CONTRACT_TOKEN, ExecutionProvider],
    },
  ],
  exports: [LidoContractService],
})
export class LidoContractModule {}

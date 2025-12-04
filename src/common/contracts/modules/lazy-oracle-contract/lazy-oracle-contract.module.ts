import { Module } from '@nestjs/common';
import { LIDO_LOCATOR_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { Contract } from 'ethers';
import { ExecutionProvider } from 'common/execution-provider';
import { LazyOracleContractService } from './lazy-oracle-contract.service';
import { LidoLocatorAbi } from '../../abi/LidoLocator';

@Module({
  providers: [
    {
      provide: LazyOracleContractService,
      useFactory: async (locatorContract: Contract, provider: ExecutionProvider) => {
        // TODO:
        //  it will fall if you don't override the contract set (CUSTOM_NETWORK_FILE_NAME),
        //  because the original hoodi locator contract does not have lazyOracle field
        //
        // The 'locatorContract.address' takes into account the override via the CUSTOM_NETWORK_FILE_NAME env
        const locatorContractWithVaultHub = new Contract(locatorContract.address, LidoLocatorAbi, provider);
        const lazyOracleAddress = await locatorContractWithVaultHub.lazyOracle();

        return new LazyOracleContractService(provider, lazyOracleAddress);
      },
      inject: [LIDO_LOCATOR_CONTRACT_TOKEN, ExecutionProvider],
    },
  ],
  exports: [LazyOracleContractService],
})
export class LazyOracleContractModule {}

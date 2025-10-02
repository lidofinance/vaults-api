import { ConfigService as ConfigServiceSource } from '@nestjs/config';
import { LidoContractModule, LidoLocatorContractModule } from '@lido-nestjs/contracts';

import { VAULT_VIEWER_CONTRACT } from 'common/contracts/contracts.constants';

import { EnvironmentVariables } from './env.validation';
import { findNetworkConfig } from './networks/utils/find-network-config';
import { NetworkConfig } from './networks';

export class ConfigService extends ConfigServiceSource<EnvironmentVariables> {
  networkConfig: NetworkConfig;
  constructor(internalConfig?: Partial<EnvironmentVariables>) {
    super(internalConfig);

    const name = this.get('CUSTOM_NETWORK_FILE_NAME');
    if (name) {
      this.networkConfig = findNetworkConfig(name);
    }

    const clApiUrls = this.get('CL_API_URLS');
    if (!Array.isArray(clApiUrls) || clApiUrls.length === 0) {
      throw new Error('[ConfigService] CL_API_URLS must be a non-empty array of URLs');
    }

    const gateways = this.get('IPFS_GATEWAYS');
    if (!Array.isArray(gateways) || gateways.length === 0) {
      throw new Error('[ConfigService] IPFS_GATEWAYS must be a non-empty array of URLs');
    }
  }

  /**
   * List of env variables that should be hidden
   */
  public get secrets(): string[] {
    const clAPIUrls = this.get('CL_API_URLS');
    const elAPIUrls = this.get('EL_RPC_URLS');
    const keys = [...clAPIUrls, ...elAPIUrls].map((url) => {
      const urlArr = url.split('/');
      return urlArr[urlArr.length - 1];
    });
    return [this.get('SENTRY_DSN') ?? '', ...keys].filter((v) => v).map((v) => String(v));
  }

  public get<T extends keyof EnvironmentVariables>(key: T): EnvironmentVariables[T] {
    return super.get(key, { infer: true }) as EnvironmentVariables[T];
  }

  /**
   * Safe getter that returns typed IPFS gateways
   */
  public get ipfsGateways(): [string, ...string[]] {
    return this.get('IPFS_GATEWAYS') as [string, ...string[]];
  }

  /**
   * Safe getter that returns typed IPFS gateways
   */
  public get clApiUrls(): [string, ...string[]] {
    return this.get('CL_API_URLS') as [string, ...string[]];
  }

  public async getCustomConfigContractsAddressMap() {
    const name = this.get('CUSTOM_NETWORK_FILE_NAME');

    if (!name) {
      return null;
    }

    if (!this.networkConfig) {
      return null;
    }

    const contracts = this.networkConfig.contracts;

    return new Map<symbol, string>([
      [LidoContractModule.contractToken, contracts.lido],
      [LidoLocatorContractModule.contractToken, contracts.lidoLocator],
      [VAULT_VIEWER_CONTRACT, contracts.vaultViewer],
    ]);
  }

  public get jobs() {
    return {
      // TODO: move to the ENVs ???
      vaultsBatchSize: 50,
      vaultsCron: '0 * * * *', // every hour at **:00 UTC
      // vaultsCron: '43 * * * *',
      vaultsCronTZ: 'UTC',

      vaultMembersBatchSize: 10,
      vaultMembersCron: '2 0 * * *', // once per day at 00:02 UTC
      // vaultMembersCron: '46 * * * *',
      vaultMembersCronTZ: 'UTC',

      reportBatchSize: 100,
      // reportCron: '3 * * * *', // every hour at **:03 UTC
      reportCron: '48 * * * *',
      reportCronTZ: 'UTC',
    };
  }
}

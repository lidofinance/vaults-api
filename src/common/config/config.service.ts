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
  }

  /**
   * List of env variables that should be hidden
   */
  public get secrets(): string[] {
    return [this.get('SENTRY_DSN') ?? ''].filter((v) => v).map((v) => String(v));
  }

  public get<T extends keyof EnvironmentVariables>(key: T): EnvironmentVariables[T] {
    return super.get(key, { infer: true }) as EnvironmentVariables[T];
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
      vaultsHourlyBatchSize: 50,
      vaultsHourlyCron: '0 * * * *', // every hour at minute 00 UTC (**:00)
      vaultsHourlyCronTZ: 'UTC',
    };
  }
}

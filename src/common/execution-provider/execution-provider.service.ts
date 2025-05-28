import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { CHAINS } from '@lido-nestjs/constants';
import { LoggerService } from '@lido-nestjs/logger';

// import { PrometheusService } from '../prometheus';
import { LOGGER_PROVIDER } from '../logger';

@Injectable()
export class ExecutionProviderService {
  constructor(
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    // protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {}

  public async getNetworkName(): Promise<string> {
    const network = await this.provider.getNetwork();
    const name = CHAINS[network.chainId]?.toLocaleLowerCase();
    return name || network.name;
  }

  public async getChainId(): Promise<number> {
    const { chainId } = await this.provider.getNetwork();
    return chainId;
  }

  public async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }
}

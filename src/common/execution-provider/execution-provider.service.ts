import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FallbackProviderEvents, SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { CHAINS } from '@lido-nestjs/constants';
import { LoggerService } from '@lido-nestjs/logger';

import { LOGGER_PROVIDER } from '../logger';
import { PrometheusService } from '../prometheus';
import { RPC_NETWORK_NAME } from '../prometheus/prometheus.constants';
import { extractRpcErrorCode, normalizeRpcProvider } from '../prometheus/rpc-metrics.utils';

@Injectable()
export class ExecutionProviderService {
  private confirmationBlocks = 8;

  constructor(
    protected readonly provider: SimpleFallbackJsonRpcBatchProvider,
    protected readonly prometheusService: PrometheusService,
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {
    this.instrumentRpcRequests();
    this.instrumentBatchMetrics();
  }

  /**
   * `http_rpc_requests_total` needs the JSON-RPC method name, which fetchMiddlewares never sees
   * (it only fires after ethers has already batched calls together). `perform()` is the one choke
   * point every ethers call goes through before batching, so it's wrapped here instead of a middleware.
   */
  private instrumentRpcRequests(): void {
    const originalPerform = this.provider.perform.bind(this.provider);
    const chainId = String(this.configService.get('CHAIN_ID'));

    this.provider.perform = async (method: string, params: { [name: string]: unknown }) => {
      try {
        const result = await originalPerform(method, params);
        this.observeRpcRequest(method, chainId, 'success', '');
        return result;
      } catch (error) {
        this.observeRpcRequest(method, chainId, 'fail', extractRpcErrorCode(error));
        throw error;
      }
    };
  }

  // Recording the metric is deliberately outside the try/catch that determines the RPC
  // call's own outcome: a bug here must never mask or replace the real result/error.
  private observeRpcRequest(method: string, chainId: string, result: 'success' | 'fail', rpcErrorCode: string): void {
    try {
      this.prometheusService.httpRpcRequestsTotal.inc({
        network: RPC_NETWORK_NAME,
        layer: 'el',
        chain_id: chainId,
        provider: this.getActiveProviderDomain(),
        method,
        result,
        rpc_error_code: rpcErrorCode,
      });
    } catch (error) {
      this.logger.error('Failed to observe http_rpc_requests_total', { error });
    }
  }

  // `provider` (the active fallback connection) is `protected` on the library class; it's only
  // informational, so read it through a cast rather than skipping the label entirely.
  private getActiveProviderDomain(): string {
    const fallback = (this.provider as unknown as { provider: { provider: { domain: string } } }).provider;
    return normalizeRpcProvider(fallback.provider.domain);
  }

  /**
   * `http_rpc_batch_size` / `http_rpc_request_payload_bytes` need the outgoing JSON-RPC batch
   * body, which fetchMiddlewares never sees. The library emits it via `eventEmitter` right before
   * the HTTP call, so no transport patch or library upgrade is needed.
   */
  private instrumentBatchMetrics(): void {
    const chainId = String(this.configService.get('CHAIN_ID'));

    this.provider.eventEmitter.on('rpc', (event: FallbackProviderEvents) => {
      if (event.action !== 'provider:request-batched') return;

      try {
        const rpcLabels = {
          network: RPC_NETWORK_NAME,
          layer: 'el',
          chain_id: chainId,
          provider: normalizeRpcProvider(event.domain),
        };
        this.prometheusService.httpRpcBatchSize.observe(rpcLabels, event.request.length);
        this.prometheusService.httpRpcRequestPayloadBytes.observe(
          rpcLabels,
          Buffer.byteLength(JSON.stringify(event.request)),
        );
      } catch (error) {
        // Never let metrics bookkeeping break the batch aggregator.
        this.logger.error('Failed to observe EL batch metrics', { error });
      }
    });
  }

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

  public async getSafeBlockNumber(): Promise<number> {
    const latest = await this.provider.getBlockNumber();
    return Math.max(0, latest - this.confirmationBlocks);
  }
}

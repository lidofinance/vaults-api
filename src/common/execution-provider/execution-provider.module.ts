import { Global, Module } from '@nestjs/common';
import { FallbackProviderModule } from '@lido-nestjs/execution';
import { NonEmptyArray } from '@lido-nestjs/execution/dist/interfaces/non-empty-array';
import type { ConnectionInfo } from '@ethersproject/web';
import { PrometheusService } from 'common/prometheus';
import { RPC_NETWORK_NAME } from 'common/prometheus/prometheus.constants';
import { normalizeRpcProvider } from 'common/prometheus/rpc-metrics.utils';
import { ConfigService } from 'common/config';
import { APP_USER_AGENT } from 'app/app.constants';
import { ExecutionProviderService } from './execution-provider.service';

@Global()
@Module({
  imports: [
    FallbackProviderModule.forRootAsync({
      async useFactory(configService: ConfigService, prometheusService: PrometheusService) {
        const urls = configService.get('EL_RPC_URLS').map(
          (url): ConnectionInfo => ({
            url,
            headers: { 'User-Agent': APP_USER_AGENT },
          }),
        ) as NonEmptyArray<ConnectionInfo>;
        const network = configService.get('CHAIN_ID');
        const chainId = String(network);

        return {
          urls,
          network,
          fetchMiddlewares: [
            async (next, ctx) => {
              const endTimer = prometheusService.elRpcRequestDuration.startTimer();
              const startedAt = Date.now();
              const rpcLabels = {
                network: RPC_NETWORK_NAME,
                layer: 'el',
                chain_id: chainId,
                provider: normalizeRpcProvider(ctx?.domain ?? ''),
              };

              try {
                const result = await next();
                endTimer({ result: 'success' });
                prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
                prometheusService.httpRpcResponsePayloadBytes.observe(
                  rpcLabels,
                  Buffer.byteLength(JSON.stringify(result)),
                );
                return result;
              } catch (error) {
                endTimer({ result: 'error' });
                prometheusService.httpRpcResponseSeconds.observe(rpcLabels, (Date.now() - startedAt) / 1000);
                throw error;
              }
            },
          ],
        };
      },
      inject: [ConfigService, PrometheusService],
    }),
  ],
  providers: [ExecutionProviderService],
  exports: [ExecutionProviderService],
})
export class ExecutionProviderModule {}

import { ExecutionProviderService } from './execution-provider.service';

jest.mock('common/prometheus', () => ({
  PrometheusService: class PrometheusService {},
}));
jest.mock('common/logger', () => ({
  LOGGER_PROVIDER: Symbol('LOGGER_PROVIDER'),
}));

describe('ExecutionProviderService RPC instrumentation', () => {
  const chainId = 1;

  let provider: {
    perform: jest.Mock;
    eventEmitter: { on: jest.Mock };
    provider: { provider: { domain: string } };
  };
  let prometheusService: {
    httpRpcRequestsTotal: { inc: jest.Mock };
    httpRpcBatchSize: { observe: jest.Mock };
    httpRpcRequestPayloadBytes: { observe: jest.Mock };
  };
  let configService: { get: jest.Mock };
  let logger: { error: jest.Mock };

  beforeEach(() => {
    provider = {
      perform: jest.fn().mockResolvedValue('result'),
      eventEmitter: { on: jest.fn() },
      provider: { provider: { domain: 'https://lb.drpc.org/abc' } },
    };
    prometheusService = {
      httpRpcRequestsTotal: { inc: jest.fn() },
      httpRpcBatchSize: { observe: jest.fn() },
      httpRpcRequestPayloadBytes: { observe: jest.fn() },
    };
    configService = { get: jest.fn((key: string) => (key === 'CHAIN_ID' ? chainId : undefined)) };
    logger = { error: jest.fn() };
  });

  const createService = () =>
    new ExecutionProviderService(provider as any, prometheusService as any, configService as any, logger as any);

  it('increments http_rpc_requests_total on a successful perform', async () => {
    createService();

    await expect(provider.perform('getBlockNumber', {})).resolves.toBe('result');

    expect(prometheusService.httpRpcRequestsTotal.inc).toHaveBeenCalledWith({
      network: 'ethereum',
      layer: 'el',
      chain_id: '1',
      provider: 'drpc.org',
      method: 'getBlockNumber',
      result: 'success',
      rpc_error_code: '',
    });
  });

  it('increments http_rpc_requests_total with rpc_error_code on a failed perform', async () => {
    provider.perform = jest.fn().mockRejectedValue({ code: -32603, message: 'boom' });
    createService();

    await expect(provider.perform('getBlockNumber', {})).rejects.toEqual({ code: -32603, message: 'boom' });

    expect(prometheusService.httpRpcRequestsTotal.inc).toHaveBeenCalledWith({
      network: 'ethereum',
      layer: 'el',
      chain_id: '1',
      provider: 'drpc.org',
      method: 'getBlockNumber',
      result: 'fail',
      rpc_error_code: '-32603',
    });
  });

  it('observes batch size and request payload on provider:request-batched', () => {
    createService();

    const rpcListener = provider.eventEmitter.on.mock.calls.find(([name]) => name === 'rpc')[1];
    rpcListener({
      action: 'provider:request-batched',
      request: [{ method: 'a' }, { method: 'b' }],
      domain: 'https://lb.drpc.org/abc',
    });

    const labels = { network: 'ethereum', layer: 'el', chain_id: '1', provider: 'drpc.org' };
    expect(prometheusService.httpRpcBatchSize.observe).toHaveBeenCalledWith(labels, 2);
    expect(prometheusService.httpRpcRequestPayloadBytes.observe).toHaveBeenCalledWith(labels, expect.any(Number));
  });
});

import { calculateIPFSAddCID } from '@lidofinance/lsv-cli/dist/utils/ipfs';
import { getVaultReport } from '@lidofinance/lsv-cli/dist/utils/report/report';
import { getReportProofByVault } from '@lidofinance/lsv-cli/dist/utils/report/report-proof';

import { LsvService } from './lsv.service';

jest.mock('common/prometheus', () => ({
  PrometheusService: class PrometheusService {},
}));
jest.mock('common/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('common/logger', () => ({
  LOGGER_PROVIDER: Symbol('LOGGER_PROVIDER'),
  LoggerService: class LoggerService {},
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/ipfs', () => ({
  calculateIPFSAddCID: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/report/report', () => ({
  getVaultReport: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/proof/create-proof', () => ({
  createPDGProof: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/report/report-proof', () => ({
  getReportProofByVault: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/rebase-rewards', () => ({
  calculateRebaseReward: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/health/calculate-health', () => ({
  calculateHealth: jest.fn(),
}));
jest.mock('@lidofinance/lsv-cli/dist/utils/statistic/report-statistic', () => ({
  reportMetrics: jest.fn(),
  calcAccruedFeeOffChain: jest.fn(),
}));

describe('LsvService', () => {
  const cid = 'QmPK1s3pNYLi9ERiq3BDxKa4XosgWwFRQUydHUtz4YgpqB';
  const gateway = 'https://ipfs.io/ipfs';
  const fallbackGateway = 'https://dweb.link/ipfs';
  const maxBytes = 20 * 1024 * 1024;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES') return maxBytes;
      return undefined;
    }),
    ipfsGateways: [gateway, fallbackGateway],
  };

  const prometheusService = {
    ipfsRequestDuration: {
      startTimer: jest.fn(() => jest.fn()),
    },
    ipfsOverallRequestDuration: {
      startTimer: jest.fn(() => jest.fn()),
    },
  };

  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
  };

  let service: LsvService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LsvService(configService as any, prometheusService as any, logger as any);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('rejects IPFS reports larger than REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES from content-length', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn((name: string) => (name.toLowerCase() === 'content-length' ? '2785017856' : null)),
      },
    });

    await expect(service.fetchIPFS(cid)).rejects.toThrow(
      `IPFS report is too large (checked with content-length): contentLength=2785017856, maxBytes=${maxBytes}`,
    );

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { signal: expect.any(AbortSignal) });
    expect(fetchMock).not.toHaveBeenCalledWith(`${fallbackGateway}/${cid}`, expect.anything());
    expect(calculateIPFSAddCID).not.toHaveBeenCalled();
  });

  it('downloads IPFS report using bounded stream when content-length is within the limit', async () => {
    const report = { values: [], tree: [] };
    const encodedReport = new TextEncoder().encode(JSON.stringify(report));
    const calculatedCid = {
      toString: () => cid,
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn((name: string) => (name.toLowerCase() === 'content-length' ? String(encodedReport.length) : null)),
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encodedReport);
          controller.close();
        },
      }),
    });
    (calculateIPFSAddCID as jest.Mock).mockResolvedValue(calculatedCid);

    await expect(service.fetchIPFS(cid)).resolves.toEqual(report);

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { signal: expect.any(AbortSignal) });
    expect(calculateIPFSAddCID).toHaveBeenCalledWith(encodedReport);
  });

  it('downloads IPFS report using bounded stream when content-length is missing', async () => {
    const report = { values: [], tree: [] };
    const encodedReport = new TextEncoder().encode(JSON.stringify(report));
    const calculatedCid = {
      toString: () => cid,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn(() => null),
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encodedReport);
          controller.close();
        },
      }),
    });
    (calculateIPFSAddCID as jest.Mock).mockResolvedValue(calculatedCid);

    await expect(service.fetchIPFS(cid)).resolves.toEqual(report);

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { signal: expect.any(AbortSignal) });
    expect(calculateIPFSAddCID).toHaveBeenCalledWith(encodedReport);
  });

  it('rejects IPFS reports that exceed the limit while streaming', async () => {
    const firstChunk = new Uint8Array(maxBytes);
    const secondChunk = new Uint8Array(1);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn(() => null),
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(firstChunk);
          controller.enqueue(secondChunk);
          controller.close();
        },
      }),
    });

    await expect(service.fetchIPFS(cid)).rejects.toThrow(
      `IPFS report is too large (checked with streaming): receivedBytes=${maxBytes + 1}, maxBytes=${maxBytes}`,
    );

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { signal: expect.any(AbortSignal) });
    expect(fetchMock).not.toHaveBeenCalledWith(`${fallbackGateway}/${cid}`, expect.anything());
    expect(calculateIPFSAddCID).not.toHaveBeenCalled();
  });

  describe('lsv-cli gateway calls are instrumented', () => {
    const vault = '0x1234567890AbcdEF1234567890aBcdef12345678' as const;

    let endTimer: jest.Mock;
    let endOverallTimer: jest.Mock;

    beforeEach(() => {
      endTimer = jest.fn();
      endOverallTimer = jest.fn();
      prometheusService.ipfsRequestDuration.startTimer.mockReturnValue(endTimer);
      prometheusService.ipfsOverallRequestDuration.startTimer.mockReturnValue(endOverallTimer);
    });

    it('observes a successful getVaultReport for the gateway that served it', async () => {
      const report = { data: {} };
      (getVaultReport as jest.Mock).mockResolvedValue(report);

      await expect(service.getVaultReport(vault, cid)).resolves.toBe(report);

      expect(getVaultReport).toHaveBeenCalledTimes(1);
      expect(endTimer.mock.calls).toEqual([[{ result: 'success', gateway }]]);
      expect(endOverallTimer.mock.calls).toEqual([[{ result: 'success' }]]);
    });

    it('observes a failed getVaultReport per gateway and succeeds on the fallback', async () => {
      const report = { data: {} };
      (getVaultReport as jest.Mock).mockRejectedValueOnce(new Error('gateway is down')).mockResolvedValueOnce(report);

      await expect(service.getVaultReport(vault, cid)).resolves.toBe(report);

      expect(endTimer.mock.calls).toEqual([
        [{ result: 'error', gateway }],
        [{ result: 'success', gateway: fallbackGateway }],
      ]);
      expect(endOverallTimer.mock.calls).toEqual([[{ result: 'success' }]]);
    });

    it('observes a missing vault in getReportProofByVault as not_found without trying other gateways', async () => {
      (getReportProofByVault as jest.Mock).mockRejectedValue(new Error(`Vault ${vault} not found in report`));

      await expect(service.getReportProofByVault(vault, cid)).resolves.toBeNull();

      expect(getReportProofByVault).toHaveBeenCalledTimes(1);
      expect(endTimer.mock.calls).toEqual([[{ result: 'not_found', gateway }]]);
      expect(endOverallTimer.mock.calls).toEqual([[{ result: 'not_found' }]]);
    });

    it('observes an error per gateway and overall when every gateway fails getReportProofByVault', async () => {
      (getReportProofByVault as jest.Mock).mockRejectedValue(new Error('gateway is down'));

      await expect(service.getReportProofByVault(vault, cid)).rejects.toThrow('gateway is down');

      expect(endTimer.mock.calls).toEqual([
        [{ result: 'error', gateway }],
        [{ result: 'error', gateway: fallbackGateway }],
      ]);
      expect(endOverallTimer.mock.calls).toEqual([[{ result: 'error', cid }]]);
    });
  });
});

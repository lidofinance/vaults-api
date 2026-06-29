import { fetchIPFS } from '@lidofinance/lsv-cli/dist/utils/ipfs';

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
  fetchIPFS: jest.fn(),
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
  const maxBytes = 20 * 1024 * 1024;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES') return maxBytes;
      return undefined;
    }),
    ipfsGateways: [gateway],
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
  };

  let service: LsvService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LsvService(configService as any, prometheusService as any, logger as any);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('rejects IPFS reports larger than REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES before downloading body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn((name: string) => (name.toLowerCase() === 'content-length' ? '2785017856' : null)),
      },
    });

    await expect(service.fetchIPFS(cid)).rejects.toThrow(
      `IPFS report is too large: contentLength=2785017856, maxBytes=${maxBytes}`,
    );

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { method: 'HEAD' });
    expect(fetchIPFS).not.toHaveBeenCalled();
  });

  it('downloads IPFS report when content-length is within the limit', async () => {
    const report = { values: [], tree: [] };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn((name: string) => (name.toLowerCase() === 'content-length' ? '10397' : null)),
      },
    });
    (fetchIPFS as jest.Mock).mockResolvedValue(report);

    await expect(service.fetchIPFS(cid)).resolves.toBe(report);

    expect(fetchMock).toHaveBeenCalledWith(`${gateway}/${cid}`, { method: 'HEAD' });
    expect(fetchIPFS).toHaveBeenCalledWith(
      {
        cid,
        gateway,
        bigNumberType: 'string',
      },
      false,
    );
  });
});

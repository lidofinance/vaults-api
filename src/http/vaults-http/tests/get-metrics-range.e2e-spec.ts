import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { bootstrapTestApp, closeTestApp, vaultAddress } from './vaults-http.controller.e2e-setup';
import { vaultLatestMetricsRangeExample } from '../example';

describe('VaultsHttpController (e2e) - getVaultStatsRangeByAddress', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getVaultReportStatsInRange.mockResolvedValue(vaultLatestMetricsRangeExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    const bad = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${bad}/metrics-range`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: no ranges provided`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/metrics-range`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.OK}: returns metrics for block range`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 100, toBlock: 200 });

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultLatestMetricsRangeExample);

    expect(vaultDbServiceMock.getVaultReportStatsInRange).toHaveBeenCalledWith(
      vaultAddress,
      undefined,
      undefined,
      100,
      200,
    );
  });

  it(`${HttpStatus.OK}: returns metrics for timestamp range`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: 10, toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultLatestMetricsRangeExample);

    expect(vaultDbServiceMock.getVaultReportStatsInRange).toHaveBeenCalledWith(vaultAddress, 10, 20);
  });
});

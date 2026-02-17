import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { bootstrapTestApp, closeTestApp, vaultAddress } from './vaults-http.controller.e2e-setup';
import { vaultLatestMetricsExample } from '../example';

describe('VaultsHttpController (e2e) - getLatestVaultStatsByAddress', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getLatestVaultReportStats.mockResolvedValue(vaultLatestMetricsExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    const bad = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${bad}/latest-metrics`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getLatestVaultReportStats).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: vault not found`, async () => {
    vaultDbServiceMock.getLatestVaultReportStats.mockResolvedValueOnce(null);

    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/latest-metrics`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getLatestVaultReportStats).toHaveBeenCalledWith(vaultAddress);
  });

  it(`${HttpStatus.OK}: returns latest metrics`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/latest-metrics`);

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultLatestMetricsExample);
    expect(vaultDbServiceMock.getLatestVaultReportStats).toHaveBeenCalledWith(vaultAddress);
  });
});

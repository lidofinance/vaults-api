import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp } from './vaults-http.controller.e2e-setup';
import { vaultsOverviewExample } from '../example';

describe('VaultsHttpController (e2e) - getVaultsOverview', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    vaultDbServiceMock.getVaultsCount.mockResolvedValue(vaultsOverviewExample.totalVaults);

    vaultDbServiceMock.getTvl.mockResolvedValue({
      tvlWei: vaultsOverviewExample.tvlWei,
      updatedAt: vaultsOverviewExample.updatedAt,
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.OK}: returns overview (tvl + totalVaults)`, async () => {
    const resp = await request(app.getHttpServer()).get('/v1/vaults/overview');

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultsOverviewExample);

    expect(vaultDbServiceMock.getVaultsCount).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getTvl).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultsCount).toHaveBeenCalledWith();
    expect(vaultDbServiceMock.getTvl).toHaveBeenCalledWith();
  });
});

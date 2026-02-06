import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { bootstrapTestApp, closeTestApp, vaultAddress } from './vaults-http.controller.e2e-setup';
import { vaultAprSmaForDaysExample } from '../example';

describe('VaultsHttpController (e2e) - getVaultAprSmaForDays', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getVaultAprSmaForDays.mockResolvedValue(vaultAprSmaForDaysExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    const bad = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${bad}/apr/sma`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultAprSmaForDays).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: vault not found`, async () => {
    vaultDbServiceMock.getVaultAprSmaForDays.mockResolvedValueOnce(null);

    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/apr/sma`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultAprSmaForDays).toHaveBeenCalledTimes(1);
  });

  it(`${HttpStatus.OK}: returns apr sma`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/apr/sma`);

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultAprSmaForDaysExample);
    expect(vaultDbServiceMock.getVaultAprSmaForDays).toHaveBeenCalledTimes(1);
  });
});

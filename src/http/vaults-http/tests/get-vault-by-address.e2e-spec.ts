import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp, accountAddress } from './vaults-http.controller.e2e-setup';
import { vaultExample } from '../example';

describe('VaultsHttpController (e2e) - getVaultByAddress', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getVaultData.mockResolvedValue(vaultExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vault address`, async () => {
    const badAddress = '0x123';
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${badAddress}`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultData).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: vault not found`, async () => {
    vaultDbServiceMock.getVaultData.mockResolvedValue(null);

    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${accountAddress}`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body).toBeDefined();
    expect(vaultDbServiceMock.getVaultData).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultData).toHaveBeenCalledWith(accountAddress);
  });

  it(`${HttpStatus.OK}: returns vault data`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${accountAddress}`);

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultExample);

    expect(vaultDbServiceMock.getVaultData).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultData).toHaveBeenCalledWith(accountAddress);
  });
});

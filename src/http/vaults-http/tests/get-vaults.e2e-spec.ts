import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { SortFieldsEnum, DirectionEnum } from 'db/vault-db/enums';
import { vaultsExample } from '../example';
import { bootstrapTestApp, closeTestApp, accountAddress } from './vaults-http.controller.e2e-setup';

const nextUpdateAtMock = '2026-01-01T11:22:33.000Z';
const expectedNextUpdateAt = '2026-01-01T12:00:00.000Z';

describe('VaultsHttpController (e2e) - getVaultsByRoleAndAddress', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);

    // for VaultsHttpController.getNextVaultsHourlyUpdate
    jest.useFakeTimers();
    jest.setSystemTime(new Date(nextUpdateAtMock));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData.mockResolvedValue({
      lastReportMeta: vaultsExample.lastReportMeta,
      totalVaults: vaultsExample.total,
      vaults: vaultsExample.data,
    });
  });

  afterAll(async () => {
    jest.useRealTimers();
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: role without address`, async () => {
    const role = '__someRole__';
    const resp = await request(app.getHttpServer()).get('/v1/vaults').query({ role });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid address`, async () => {
    const badAddress = '0x123';
    const resp = await request(app.getHttpServer()).get('/v1/vaults').query({ address: badAddress });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.OK}: defaults (no filters)`, async () => {
    const resp = await request(app.getHttpServer()).get('/v1/vaults');

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toHaveProperty('nextUpdateAt');
    expect(resp.body).toHaveProperty('lastReportMeta');
    expect(resp.body).toHaveProperty('total');
    expect(resp.body).toHaveProperty('data');

    expect(resp.body).toEqual({
      nextUpdateAt: expectedNextUpdateAt,
      lastReportMeta: vaultsExample.lastReportMeta,
      total: vaultsExample.total,
      data: vaultsExample.data,
    });

    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledWith(
      10,
      0,
      SortFieldsEnum.totalValue,
      DirectionEnum.DESC,
    );
  });

  it(`${HttpStatus.OK}: passes address only`, async () => {
    const resp = await request(app.getHttpServer()).get('/v1/vaults').query({ address: accountAddress });

    expect(resp.status).toBe(HttpStatus.OK);

    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledWith(
      10,
      0,
      SortFieldsEnum.totalValue,
      DirectionEnum.DESC,
      accountAddress,
    );
  });

  it(`${HttpStatus.OK}: passes address nd role`, async () => {
    const role = 'vaults.Permissions.burn';
    const resp = await request(app.getHttpServer()).get('/v1/vaults').query({ address: accountAddress, role });

    expect(resp.status).toBe(HttpStatus.OK);

    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.getVaultsWithRoleAndSortingAndReportData).toHaveBeenCalledWith(
      10,
      0,
      SortFieldsEnum.totalValue,
      DirectionEnum.DESC,
      accountAddress,
      role,
    );
  });
});

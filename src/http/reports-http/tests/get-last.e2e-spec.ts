import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { reportByVaultExample } from '../example';
import { bootstrapTestApp, closeTestApp, vaultAddress, cid } from './reports-http.controller.e2e-setup';

const latestReportDataMock = {
  timestamp: BigInt(1),
  refSlot: BigInt(1),
  treeRoot: '__someTreeRoot__',
  reportCid: cid,
};

describe('ReportsHttpController (e2e) - getLast', () => {
  let app: INestApplication;
  let loggerMock;
  let vaultDbServiceMock;
  let lazyOracleMock;
  let lsvServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;

    ({ vaultDbServiceMock, lazyOracleMock, lsvServiceMock, loggerMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.existsVaultByAddress.mockResolvedValue(true);
    lazyOracleMock.getLatestReportData.mockResolvedValue(latestReportDataMock);
    lsvServiceMock.getReportProofByVault.mockResolvedValue(reportByVaultExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    const badAddress = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${badAddress}`);
    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.existsVaultByAddress).not.toHaveBeenCalled();
    expect(lazyOracleMock.getLatestReportData).not.toHaveBeenCalled();
    expect(lsvServiceMock.getReportProofByVault).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.NOT_FOUND}: vault does not exist`, async () => {
    vaultDbServiceMock.existsVaultByAddress.mockResolvedValue(false);
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.NOT_FOUND);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(lazyOracleMock.getLatestReportData).not.toHaveBeenCalled();
    expect(lsvServiceMock.getReportProofByVault).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.OK}: returns last report`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual({ report: reportByVaultExample });
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(lazyOracleMock.getLatestReportData).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });

  it(`${HttpStatus.OK}: report found, vault is not present in report, but controller returns { report: null }`, async () => {
    lsvServiceMock.getReportProofByVault.mockRejectedValueOnce(new Error('Vault not found in report'));
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual({ report: null });
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(String(loggerMock.error.mock.calls[0][0])).toContain(`Failed to getReportProofByVault ${vaultAddress}`);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(lazyOracleMock.getLatestReportData).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });

  it(`${HttpStatus.OK}: report not found, but controller returns { report: null }`, async () => {
    lsvServiceMock.getReportProofByVault.mockRejectedValueOnce(new Error('Report not found'));
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual({ report: null });
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(lazyOracleMock.getLatestReportData).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(lsvServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });
});

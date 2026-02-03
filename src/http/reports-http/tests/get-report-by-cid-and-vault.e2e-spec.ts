import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { reportByVaultExample } from '../example';
import { bootstrapTestApp, closeTestApp, vaultAddress, cid } from './reports-http.controller.e2e-setup';

describe('ReportsHttpController (e2e) - getReportByCidAndVault', () => {
  let app: INestApplication;
  let loggerMock;
  let vaultDbServiceMock;
  let reportsMerkleServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;

    ({ vaultDbServiceMock, reportsMerkleServiceMock, loggerMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.existsVaultByAddress.mockResolvedValue(true);
    reportsMerkleServiceMock.getReportProofByVault.mockResolvedValue(reportByVaultExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    // 1 character is missing
    const badAddress = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${badAddress}`);
    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.existsVaultByAddress).not.toHaveBeenCalled();
    expect(reportsMerkleServiceMock.getReportProofByVault).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid cid`, async () => {
    // too short
    const badCid = 'Qm' + 'a'.repeat(10);
    const resp = await request(app.getHttpServer()).get(`/v1/report/${badCid}/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.existsVaultByAddress).not.toHaveBeenCalled();
    expect(reportsMerkleServiceMock.getReportProofByVault).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.NOT_FOUND}: vault does not exist`, async () => {
    vaultDbServiceMock.existsVaultByAddress.mockResolvedValue(false);
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.NOT_FOUND);
    expect(reportsMerkleServiceMock.getReportProofByVault).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.OK}: returns vault report`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${vaultAddress}`);
    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual({ report: reportByVaultExample });
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });

  it('200: report found, vault is not present in report, but controller returns { report: null }', async () => {
    reportsMerkleServiceMock.getReportProofByVault.mockRejectedValueOnce(new Error('Vault not found in report'));
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${vaultAddress}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ report: null });
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(String(loggerMock.error.mock.calls[0][0])).toContain(`Failed to getReportProofByVault ${vaultAddress}`);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });

  it('200: report not found, but controller returns { report: null }', async () => {
    reportsMerkleServiceMock.getReportProofByVault.mockRejectedValueOnce(new Error('Report not found'));
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${vaultAddress}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ report: null });
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledTimes(1);
    expect(vaultDbServiceMock.existsVaultByAddress).toHaveBeenCalledWith(vaultAddress);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledTimes(1);
    expect(reportsMerkleServiceMock.getReportProofByVault).toHaveBeenCalledWith(vaultAddress, cid);
  });
});

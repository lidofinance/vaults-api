import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType, HttpStatus } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ReportsHttpController } from '../reports-http.controller';
import { reportByVaultExample } from '../example';

jest.mock('common/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('common/contracts/modules/lazy-oracle-contract', () => ({
  LazyOracleContractService: class LazyOracleContractService {},
}));
jest.mock('lsv', () => ({
  LsvService: class LsvService {},
}));
jest.mock('report/reports-merkle.service', () => ({
  ReportsMerkleService: class ReportsMerkleService {},
}));

import { ConfigService } from 'common/config';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';

import { VaultDbService } from 'db/vault-db/vault-db.service';
import { LsvService } from 'lsv';
import { ReportsMerkleService } from 'report/reports-merkle.service';

describe('ReportsHttpController (e2e) - getReportByCidAndVault', () => {
  let app: INestApplication;

  const vaultAddress = '0x' + '1'.repeat(40);
  const cid = 'Qm' + 'a'.repeat(44);

  const loggerMock = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const vaultDbServiceMock = {
    existsVaultByAddress: jest.fn(async () => true),
  };
  const lazyOracleMock = {
    getLatestReportData: jest.fn(async () => ({ reportCid: cid })),
  };
  const lsvServiceMock = {
    getReportProofByVault: jest.fn(async () => reportByVaultExample),
    getVaultReport: jest.fn(async () => ({ prevTreeCID: cid })),
  };
  const reportsMerkleServiceMock = {
    getReportProofByVault: jest.fn(async () => reportByVaultExample),
  };

  beforeAll(async () => {
    const controllers = [ReportsHttpController];

    const providers = [
      { provide: LOGGER_PROVIDER, useValue: loggerMock },
      { provide: ConfigService, useValue: {} },
      { provide: VaultDbService, useValue: vaultDbServiceMock },
      { provide: LsvService, useValue: lsvServiceMock },
      { provide: LazyOracleContractService, useValue: lazyOracleMock },
      { provide: ReportsMerkleService, useValue: reportsMerkleServiceMock },
    ];

    const moduleRef = await Test.createTestingModule({ controllers, providers }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.existsVaultByAddress.mockResolvedValue(true);
    reportsMerkleServiceMock.getReportProofByVault.mockResolvedValue(reportByVaultExample);
  });

  afterAll(async () => {
    await app.getHttpAdapter().close();
    await app.close();
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

  // it('GET /v1/report/last/:vaultAddress', async () => {
  //   const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
  //   expect(resp.status).toBe(200);
  //   expect(resp.body).toHaveProperty('report');
  // });
  //
  // it('GET /v1/report/previous/:vaultAddress', async () => {
  //   const resp = await request(app.getHttpServer()).get(`/v1/report/previous/${vaultAddress}`);
  //   expect(resp.status).toBe(200);
  //   expect(resp.body).toHaveProperty('report');
  // });
});

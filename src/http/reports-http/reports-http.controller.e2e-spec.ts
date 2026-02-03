import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ReportsHttpController } from './reports-http.controller';
import { reportByVaultExample } from './example';

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

describe('ReportsHttpController (e2e)', () => {
  let app: INestApplication;

  const vaultAddress = '0x' + '1'.repeat(40);
  const cid = 'Qm' + 'a'.repeat(44);

  const loggerMock = { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

  const vaultDbServiceMock = { existsVaultByAddress: jest.fn(async () => true) };
  const lazyOracleMock = { getLatestReportData: jest.fn(async () => ({ reportCid: cid })) };
  const lsvServiceMock = {
    getReportProofByVault: jest.fn(async () => reportByVaultExample),
    getVaultReport: jest.fn(async () => ({ prevTreeCID: cid })),
  };
  const reportsMerkleServiceMock = { getReportProofByVault: jest.fn(async () => reportByVaultExample) };

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

  afterAll(async () => {
    await app.getHttpAdapter().close();
    await app.close();
  });

  it('GET /v1/report/:cid/:vaultAddress', async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/report/${cid}/${vaultAddress}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty('report');
  });

  it('GET /v1/report/last/:vaultAddress', async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/report/last/${vaultAddress}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty('report');
  });

  it('GET /v1/report/previous/:vaultAddress', async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/report/previous/${vaultAddress}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty('report');
  });
});

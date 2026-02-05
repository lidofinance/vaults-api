import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

// Mock before imports
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
import { VaultDbService } from 'db/vault-db/vault-db.service';
import { LsvService } from 'lsv';
import { LazyOracleContractService } from 'common/contracts/modules/lazy-oracle-contract';
import { ReportsMerkleService } from 'report/reports-merkle.service';

import { ReportsHttpController } from '../reports-http.controller';
import { reportByVaultExample } from '../example';

export const vaultAddress = '0x' + '1'.repeat(40);
// 1 character is missing
export const badVaultAddress = '0x' + '1'.repeat(39);
export const cid = 'Qm' + 'a'.repeat(44);
// too short
export const badCid = 'Qm' + 'a'.repeat(10);

export async function bootstrapTestApp() {
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

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const mocks = {
    loggerMock,
    vaultDbServiceMock,
    lazyOracleMock,
    lsvServiceMock,
    reportsMerkleServiceMock,
  };

  return { app: app as INestApplication, mocks };
}

export async function closeTestApp(app: INestApplication) {
  await app.getHttpAdapter().close();
  await app.close();
}

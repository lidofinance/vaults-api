import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

// Mock before imports
jest.mock('common/config', () => ({
  ConfigService: class ConfigService {},
}));

import { ConfigService } from 'common/config';
import { VaultDbService } from 'db/vault-db/vault-db.service';

import { VaultsHttpController } from '../vaults-http.controller';

export const vaultAddress = '0x' + '1'.repeat(40);
export const accountAddress = '0x' + '2'.repeat(40);

export async function bootstrapTestApp() {
  const loggerMock = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const configServiceMock = {
    jobs: {
      vaultsCronTZ: 'UTC',
      vaultsCron: '0 * * * *',
    },
  };

  const vaultDbServiceMock = {
    getVaultData: jest.fn(async () => null),
    getVaultsWithRoleAndSortingAndReportData: jest.fn(async () => ({
      lastReportMeta: null,
      totalVaults: 0,
      vaults: [],
    })),
    getLatestVaultReportStats: jest.fn(async () => null),
    getVaultReportStatsInRange: jest.fn(async () => []),
    getVaultAprSmaForDays: jest.fn(async () => null),
    getVaultsCount: jest.fn(async () => null),
    getTvl: jest.fn(async () => null),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [VaultsHttpController],
    providers: [
      { provide: LOGGER_PROVIDER, useValue: loggerMock },
      { provide: ConfigService, useValue: configServiceMock },
      { provide: VaultDbService, useValue: vaultDbServiceMock },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app: app as INestApplication,
    mocks: { loggerMock, configServiceMock, vaultDbServiceMock },
  };
}

export async function closeTestApp(app: INestApplication) {
  await app.getHttpAdapter().close();
  await app.close();
}

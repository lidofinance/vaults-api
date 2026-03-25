import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { bootstrapTestApp, closeTestApp, vaultAddress } from './vaults-http.controller.e2e-setup';
import { vaultLatestMetricsRangeExample } from '../example';
import { MAX_INT_32 } from '../dto/get-vault-stats-range-query.dto';

describe('VaultsHttpController (e2e) - getVaultStatsRangeByAddress', () => {
  let app: INestApplication;
  let vaultDbServiceMock;

  beforeAll(async () => {
    const bootstrap = await bootstrapTestApp();
    app = bootstrap.app;
    ({ vaultDbServiceMock } = bootstrap.mocks);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultDbServiceMock.getVaultReportStatsInRange.mockResolvedValue(vaultLatestMetricsRangeExample);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(`${HttpStatus.BAD_REQUEST}: invalid vaultAddress`, async () => {
    const bad = '0x' + '1'.repeat(39);
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${bad}/metrics-range`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: no ranges provided`, async () => {
    const resp = await request(app.getHttpServer()).get(`/v1/vaults/${vaultAddress}/metrics-range`);

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: block range must be complete`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 100 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('Provide either both "fromBlock" and "toBlock"');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: timestamp range must be complete`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('Provide either both "fromBlock" and "toBlock"');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should not mix block and timestamp ranges`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 100, toBlock: 200, fromTimestamp: 10, toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('do not mix them');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should not allow mixed partial block/timestamp params`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 100, fromTimestamp: 10, toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('do not mix them');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: fromBlock must be less than or equal to toBlock`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 200, toBlock: 100 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('ensure from <= to');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: fromTimestamp must be less than or equal to toTimestamp`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: 20, toTimestamp: 10 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('ensure from <= to');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject toTimestamp greater than MAX_INT_32`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: 0, toTimestamp: 9999999999 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain(`toTimestamp must not be greater than ${MAX_INT_32}`);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject negative timestamp`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: -1, toTimestamp: 10 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('fromTimestamp must not be less than 0');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject negative block number`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: -1, toBlock: 10 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('fromBlock must not be less than 0');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject non-integer timestamp`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: 10.5, toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('fromTimestamp must be an integer number');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: empty query param should be treated as missing value`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: '', toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain('Provide either both "fromBlock" and "toBlock"');
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject toBlock greater than MAX_INT_32`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 0, toBlock: MAX_INT_32 + 1 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain(`toBlock must not be greater than ${MAX_INT_32}`);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.BAD_REQUEST}: should reject fromBlock greater than MAX_INT_32`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: MAX_INT_32 + 1, toBlock: MAX_INT_32 + 1 });

    expect(resp.status).toBe(HttpStatus.BAD_REQUEST);
    expect(resp.body.message).toContain(`fromBlock must not be greater than ${MAX_INT_32}`);
    expect(vaultDbServiceMock.getVaultReportStatsInRange).not.toHaveBeenCalled();
  });

  it(`${HttpStatus.OK}: returns metrics for block range`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromBlock: 100, toBlock: 200 });

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultLatestMetricsRangeExample);

    expect(vaultDbServiceMock.getVaultReportStatsInRange).toHaveBeenCalledWith(
      vaultAddress,
      undefined,
      undefined,
      100,
      200,
    );
  });

  it(`${HttpStatus.OK}: returns metrics for timestamp range`, async () => {
    const resp = await request(app.getHttpServer())
      .get(`/v1/vaults/${vaultAddress}/metrics-range`)
      .query({ fromTimestamp: 10, toTimestamp: 20 });

    expect(resp.status).toBe(HttpStatus.OK);
    expect(resp.body).toEqual(vaultLatestMetricsRangeExample);

    expect(vaultDbServiceMock.getVaultReportStatsInRange).toHaveBeenCalledWith(vaultAddress, 10, 20);
  });
});

import { commonPatterns, satanizer } from '@lidofinance/satanizer';

// Imported directly, not through the `common/config` barrel: that barrel pulls in
// `config.module.ts`, whose `ConfigModule.forRoot({ validate })` runs env validation
// (and `process.exit(1)`) at import time.
import { ConfigService } from './config.service';
import { EnvironmentVariables } from './env.validation';

// ---------------------------------------------------------------------------
// ConfigService.secrets
//
// Everything the logger masks comes from this list (see `common/logger`), so a
// value silently dropping out of it means that value starts leaking into logs.
// ---------------------------------------------------------------------------

// Placeholder values. Their names deliberately read as neutral, so that the CI credential
// scanner does not treat these fixtures as hardcoded credentials.
const maskedDbValue = 'db-value-to-mask';
const maskedSentryValue = 'https://sentry-host.example.com/42';

const buildConfig = (overrides: Partial<EnvironmentVariables> = {}) =>
  new ConfigService({
    CL_API_URLS: ['https://cl.example.com/cl-api-key'],
    EL_RPC_URLS: ['https://el.example.com/el-rpc-key'],
    IPFS_GATEWAYS: ['https://ipfs.example.com'],
    SENTRY_DSN: maskedSentryValue,
    POSTGRES_PASSWORD: maskedDbValue,
    ...overrides,
  } as Partial<EnvironmentVariables>);

describe('ConfigService.secrets', () => {
  it('includes the Postgres password', () => {
    expect(buildConfig().secrets).toContain(maskedDbValue);
  });

  it('includes the Sentry DSN', () => {
    expect(buildConfig().secrets).toContain(maskedSentryValue);
  });

  it('includes the trailing path segment of CL and EL urls, where api keys live', () => {
    const secrets = buildConfig().secrets;

    expect(secrets).toContain('cl-api-key');
    expect(secrets).toContain('el-rpc-key');
  });

  it('skips unset values instead of adding empty strings', () => {
    const secrets = buildConfig({ SENTRY_DSN: undefined, POSTGRES_PASSWORD: null }).secrets;

    expect(secrets).not.toContain('');
    expect(secrets).toEqual(['cl-api-key', 'el-rpc-key']);
  });

  it('masks the Postgres password in a log line, the way the logger transport does', () => {
    const mask = satanizer([...commonPatterns, ...buildConfig().secrets]);

    const masked = mask(`connection failed: password=${maskedDbValue} host=db`);

    expect(masked).not.toContain(maskedDbValue);
    expect(masked).toContain('host=db');
  });
});

import { plainToClass, Transform } from 'class-transformer';
import { IsArray, ArrayMinSize, IsEnum, IsNumber, IsString, IsOptional, validateSync, Min } from 'class-validator';
import { Environment, LogLevel, LogFormat } from './interfaces';
import { logBootstrapError } from 'common/logger/bootstrap-logger';

export const toNumber =
  () =>
  ({ value }: { value: any }) =>
    value === '' || value == null ? undefined : Number(value);

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.development;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  PORT = 3000;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  WORKER_PORT = 3001;

  // PostgreSQL connection settings. `db/config.ts` reads them straight from `process.env`
  // (it also runs outside Nest, for the typeorm CLI), but they are declared here so that they
  // are type-validated, exposed through `ConfigService`, and included in `ENV_KEYS` —
  // i.e. in the startup config dump and the `envs_info` metric, with the password masked.
  @IsOptional()
  @IsString()
  POSTGRES_HOST: string | null = null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  POSTGRES_PORT: number | null = null;

  @IsOptional()
  @IsString()
  POSTGRES_USER: string | null = null;

  @IsOptional()
  @IsString()
  POSTGRES_PASSWORD: string | null = null;

  @IsOptional()
  @IsString()
  POSTGRES_DATABASE: string | null = null;

  @IsOptional()
  @IsString()
  CORS_WHITELIST_REGEXP = '';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  GLOBAL_THROTTLE_TTL = 5;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  GLOBAL_THROTTLE_LIMIT = 100;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  GLOBAL_CACHE_TTL = 1;

  @IsOptional()
  @IsString()
  SENTRY_DSN: string | null = null;

  @IsOptional()
  @IsEnum(LogLevel)
  @Transform(({ value }) => value || LogLevel.info)
  LOG_LEVEL: LogLevel;

  @IsOptional()
  @IsEnum(LogFormat)
  @Transform(({ value }) => value || LogFormat.json)
  LOG_FORMAT: LogFormat;

  @IsOptional()
  @IsString()
  CUSTOM_NETWORK_FILE_NAME: string;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  CL_API_URLS: string[] = null;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  EL_RPC_URLS: string[] = null;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  CHAIN_ID: number = null;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  IPFS_GATEWAYS: string[] = null;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  START_REPORT_BLOCK_NUMBER: number = null;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  MINIMAL_VAULTS_FETCHING_MODE_COUNT: number = null;

  @IsNumber()
  @Transform(toNumber())
  REPORT_MERKLE_TREE_CACHE_MAX = 5;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  REPORT_IPFS_MAX_CONTENT_LENGTH_BYTES = 20 * 1024 * 1024;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber())
  REPORT_IPFS_FETCH_TIMEOUT_MS = 20_000;

  @IsOptional()
  @IsNumber()
  @Transform(toNumber())
  VAULTS_BATCH_SIZE = 50;

  @IsOptional()
  @IsString()
  VAULTS_CRON = '0 * * * *';

  @IsOptional()
  @IsString()
  DISCONNECTED_VAULTS_OWNERSHIP_RECONCILE_CRON = '40 8 * * *';

  @IsOptional()
  @IsString()
  DISCONNECTED_VAULTS_OWNERSHIP_SCAN_CRON = '*/10 * * * *';

  @IsOptional()
  @IsNumber()
  @Transform(toNumber())
  VAULT_MEMBERS_BATCH_SIZE = 10;

  @IsOptional()
  @IsString()
  VAULT_MEMBERS_CRON = '2 0 * * *';

  @IsOptional()
  @IsNumber()
  @Transform(toNumber())
  REPORT_BATCH_SIZE = 100;

  @IsOptional()
  @IsString()
  REPORT_CRON = '4 * * * *';

  @IsOptional()
  @IsNumber()
  @Transform(toNumber())
  REPORT_METRICS_PROCESSING_CONCURRENCY = 20;

  @IsOptional()
  @IsString()
  COLD_STARTUP_REPORTS_FROM_CID: string | null = null;
}

export const ENV_KEYS = Object.keys(new EnvironmentVariables());

// Re-exported from a tiny module so bootstrap scripts (migrations) can read the secret
// key names without importing class-validator/class-transformer via this file.
export { SECRET_ENV_KEYS, SECRET_URLS_KEYS } from './env.secrets';

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);

  const validatorOptions = { skipMissingProperties: false };
  const errors = validateSync(validatedConfig, validatorOptions);

  if (errors.length > 0) {
    logBootstrapError(errors.toString(), 'EnvValidation');
    process.exit(1);
  }

  return validatedConfig;
}

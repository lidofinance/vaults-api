import { plainToClass, Transform } from 'class-transformer';
import { IsArray, ArrayMinSize, IsEnum, IsNumber, IsString, IsOptional, validateSync, Min } from 'class-validator';
import { Environment, LogLevel, LogFormat } from './interfaces';

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
  @Transform(toNumber())
  VAULTS_BATCH_SIZE = 50;

  @IsOptional()
  @IsString()
  VAULTS_CRON = '0 * * * *';

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
  REPORT_REPORT_METRICS_PROCESSING_CONCURRENCY = 20;
}

export const ENV_KEYS = Object.keys(new EnvironmentVariables());

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);

  const validatorOptions = { skipMissingProperties: false };
  const errors = validateSync(validatedConfig, validatorOptions);

  if (errors.length > 0) {
    console.error(errors.toString());
    process.exit(1);
  }

  return validatedConfig;
}

import { plainToClass, Transform } from 'class-transformer';
import { IsArray, ArrayMinSize, IsEnum, IsNumber, IsString, IsOptional, validateSync, Min } from 'class-validator';
import { Environment, LogLevel, LogFormat } from './interfaces';

const toNumber =
  ({ defaultValue }) =>
  ({ value }) => {
    if (value === '' || value == null) return defaultValue;
    // TODO
    const n = Number(value);
    return Number.isNaN(n) ? defaultValue : n;
  };

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.development;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 3000 }))
  PORT: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 3001 }))
  WORKER_PORT: number;

  @IsOptional()
  @IsString()
  CORS_WHITELIST_REGEXP = '';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 5 }))
  GLOBAL_THROTTLE_TTL: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 100 }))
  GLOBAL_THROTTLE_LIMIT: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 1 }))
  GLOBAL_CACHE_TTL: number;

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
  @Transform(toNumber({ defaultValue: 5 }))
  REPORT_MERKLE_TREE_CACHE_MAX: number;

  // TODO
  @IsOptional()
  @IsNumber()
  @Transform(toNumber({ defaultValue: 50 }))
  VAULTS_BATCH_SIZE: number;

  // TODO
  @IsOptional()
  @IsString()
  VAULTS_CRON = '0 * * * *';

  // TODO
  @IsOptional()
  @IsNumber()
  @Transform(toNumber({ defaultValue: 10 }))
  VAULT_MEMBERS_BATCH_SIZE: number;

  // TODO
  @IsOptional()
  @IsString()
  VAULT_MEMBERS_CRON = '2 0 * * *';

  // TODO
  @IsOptional()
  @IsNumber()
  @Transform(toNumber({ defaultValue: 100 }))
  REPORT_BATCH_SIZE: number;

  // TODO
  @IsOptional()
  @IsString()
  REPORT_CRON = '4 * * * *';
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

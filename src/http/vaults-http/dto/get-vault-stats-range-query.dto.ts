import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetVaultStatsRangeQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  fromBlock?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  toBlock?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  fromTimestamp?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  toTimestamp?: number;
}

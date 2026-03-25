import {
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Max value for PostgreSQL int4 (32-bit signed integer): 2_147_483_647
// blockNumber: corresponds to an estimated date ~ Wed Jun 08 2833
// timestamp: corresponds to Unix time limit → 19 Jan 2038, 03:14:07 UTC (Year 2038 problem)
export const MAX_INT_32 = 2_147_483_647;

const ToOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  });

@ValidatorConstraint({ name: 'isValidRangeQuery', async: false })
class IsValidRangeQueryConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const { fromBlock, toBlock, fromTimestamp, toTimestamp } = args.object as GetVaultStatsRangeQueryDto;

    const hasBlockRange = fromBlock !== undefined || toBlock !== undefined;
    const hasTimestampRange = fromTimestamp !== undefined || toTimestamp !== undefined;

    // do not mix block and timestamp params
    if (hasBlockRange && hasTimestampRange) return false;

    // block range must be complete
    if (hasBlockRange) {
      if (fromBlock === undefined || toBlock === undefined) return false;
      return fromBlock <= toBlock;
    }

    // timestamp range must be complete
    if (hasTimestampRange) {
      if (fromTimestamp === undefined || toTimestamp === undefined) return false;
      return fromTimestamp <= toTimestamp;
    }

    return false;
  }

  defaultMessage(): string {
    return 'Provide either both "fromBlock" and "toBlock" or both "fromTimestamp" and "toTimestamp", do not mix them, and ensure from <= to.';
  }
}

export class GetVaultStatsRangeQueryDto {
  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(0)
  @Max(MAX_INT_32)
  fromBlock?: number;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(0)
  @Max(MAX_INT_32)
  toBlock?: number;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(0)
  @Max(MAX_INT_32)
  fromTimestamp?: number;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(0)
  @Max(MAX_INT_32)
  toTimestamp?: number;

  // Required to run cross-field validation (class-validator does not support object-level validation)
  @Validate(IsValidRangeQueryConstraint)
  readonly rangeValidation?: never;
}

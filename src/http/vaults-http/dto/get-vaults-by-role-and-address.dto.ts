import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional, IsEnum, IsString } from 'class-validator';
import { getAddress } from 'viem';

import { BadRequestException } from '@nestjs/common';

import { SortFieldsEnum, DirectionEnum } from 'db/vault-db/enums';

export const maxLimitQuery = 100;
export const limitQueryDefault = 10;
export const offsetQueryDefault = 0;
export const defaultSortBy: SortFieldsEnum = SortFieldsEnum.totalValue;
export const defaultDirection: DirectionEnum = DirectionEnum.DESC;

export class GetVaultsByRoleAndAddressQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(maxLimitQuery)
  limit: number = limitQueryDefault;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = offsetQueryDefault;

  @IsOptional()
  @IsEnum(SortFieldsEnum)
  sortBy: SortFieldsEnum = defaultSortBy;

  @IsOptional()
  @IsEnum(DirectionEnum)
  direction: DirectionEnum = defaultDirection;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Transform(({ value }) => {
    // if the parameter is optional
    if (!value) return undefined;
    try {
      return getAddress(value);
    } catch {
      throw new BadRequestException(`Address must be an Ethereum address: ${value}`);
    }
  })
  address?: string;
}

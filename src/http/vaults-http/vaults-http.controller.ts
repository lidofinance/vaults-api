import { CronExpressionParser } from 'cron-parser';
import {
  Controller,
  Param,
  Get,
  Query,
  DefaultValuePipe,
  ParseEnumPipe,
  ParseIntPipe,
  Version,
  Inject,
  LoggerService,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { VaultDbService, SortFieldsEnum, DirectionEnum } from 'db/vault-db';
import { ALL_ROLE_VALUES } from 'vault/vault.constants';
import { ErrorResponseType } from 'http/common/dto/error-response-type';

import { GetVaultStatsRangeQueryDto } from './dto/get-vault-stats-range-query.dto';
import { vaultsExample, vaultLatestMetricsExample } from './example';

const limitQueryDefault = 10;
const offsetQueryDefault = 0;
const defaultSortBy: SortFieldsEnum = SortFieldsEnum.totalValue;
const defaultDirection: DirectionEnum = DirectionEnum.DESC;

@Controller('vaults')
@ApiTags('Vaults')
export class VaultsHttpController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    private readonly vaultDbService: VaultDbService,
  ) {}

  @Version('1')
  @Get('')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: limitQueryDefault,
    description: 'Number of vaults to return',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: offsetQueryDefault,
    description: 'Offset from the beginning of sorted list',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SortFieldsEnum,
    example: defaultSortBy,
    description: 'Field by which to sort vaults',
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: DirectionEnum,
    example: defaultDirection,
    description: 'Sort direction',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ALL_ROLE_VALUES,
    enumName: 'RoleOptions',
    description: 'Role constant string. Must be one of the allowed values.',
  })
  @ApiQuery({
    name: 'address',
    required: false,
    type: String,
    description: 'Account address to filter vaults by',
  })
  @ApiResponse({
    status: 200,
    description: 'Vaults list with latest state',
    schema: {
      example: vaultsExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Both "role" and "address" must be provided together.',
    type: ErrorResponseType,
  })
  async getVaultsByRoleAndAddress(
    @Query('limit', new DefaultValuePipe(limitQueryDefault), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(offsetQueryDefault), ParseIntPipe) offset: number,
    @Query('sortBy', new DefaultValuePipe(defaultSortBy), new ParseEnumPipe(SortFieldsEnum)) sortBy: SortFieldsEnum,
    @Query('direction', new DefaultValuePipe(defaultDirection), new ParseEnumPipe(DirectionEnum))
    direction: DirectionEnum,
    @Query('role') role: string,
    @Query('address') address: string,
  ) {
    const hasRole = !!role;
    const hasAddress = !!address;
    if ((hasRole && !hasAddress) || (!hasRole && hasAddress)) {
      throw new BadRequestException('Both "role" and "address" must be provided together.');
    }

    const { lastReportMeta, totalVaults, vaults } = await this.vaultDbService.getVaultsWithRoleAndSortingAndReportData(
      limit,
      offset,
      sortBy,
      direction,
      ...(hasRole && hasAddress ? [role, address] : [])
    );

    return {
      nextUpdateAt: this.getNextVaultsHourlyUpdate(),
      lastReportMeta,
      total: totalVaults,
      data: vaults,
    };
  }

  @Version('1')
  @Get(':vaultAddress/latest-metrics')
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiResponse({
    status: 200,
    description: 'Vault with latest metrics',
    schema: {
      example: vaultLatestMetricsExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault not found or has no stats.',
    type: ErrorResponseType,
  })
  async getLatestVaultStatsByAddress(@Param('vaultAddress') vaultAddress: string) {
    const latestStats = await this.vaultDbService.getLatestVaultReportStats(vaultAddress);
    if (!latestStats) {
      throw new BadRequestException('Vault not found or has no stats.');
    }

    return latestStats;
  }

  @Version('1')
  @Get(':vaultAddress/metrics-range')
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiQuery({ name: 'fromTimestamp', required: false, type: Number })
  @ApiQuery({ name: 'toTimestamp', required: false, type: Number })
  @ApiQuery({ name: 'fromBlock', required: false, type: Number })
  @ApiQuery({ name: 'toBlock', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vaults with latest metrics',
    schema: {
      example: [vaultLatestMetricsExample, vaultLatestMetricsExample],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'You must provide either both "fromBlock" & "toBlock" or both "fromTimestamp" & "toTimestamp".',
    type: ErrorResponseType,
  })
  async getVaultStatsRangeByAddress(
    @Param('vaultAddress') vaultAddress: string,
    @Query() query: GetVaultStatsRangeQueryDto,
  ) {
    const { fromBlock, toBlock, fromTimestamp, toTimestamp } = query;

    const hasBlockRange = fromBlock !== undefined && toBlock !== undefined;
    const hasTimestampRange = fromTimestamp !== undefined && toTimestamp !== undefined;

    if (!hasBlockRange && !hasTimestampRange) {
      throw new BadRequestException(
        'You must provide either both "fromBlock" & "toBlock" or both "fromTimestamp" & "toTimestamp".',
      );
    }

    if (hasBlockRange) {
      return this.vaultDbService.getVaultReportStatsInRange(vaultAddress, undefined, undefined, fromBlock, toBlock);
    }

    // by timestamps
    return this.vaultDbService.getVaultReportStatsInRange(vaultAddress, fromTimestamp, toTimestamp);
  }

  private getNextVaultsHourlyUpdate(): Date {
    const options = { currentDate: new Date(), tz: this.configService.jobs['vaultsCronTZ'] };
    const interval = CronExpressionParser.parse(this.configService.jobs['vaultsCron'], options);
    return interval.next().toDate();
  }
}

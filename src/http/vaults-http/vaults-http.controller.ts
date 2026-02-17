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
import { CacheTTL } from '@nestjs/cache-manager';

import { ConfigService } from 'common/config';
import { VaultDbService } from 'db/vault-db/vault-db.service';
import { VAULT_APR_SMA_DAYS } from 'db/vault-db/vault-db.constants';
import { SortFieldsEnum, DirectionEnum } from 'db/vault-db/enums';
import { ALL_ROLE_VALUES } from 'vault/vault.constants';
import { ErrorResponseType } from 'http/common/dto/error-response-type';
import { ToChecksumEthAddressPipe } from 'http/common/pipes';

import { GetVaultStatsRangeQueryDto } from './dto/get-vault-stats-range-query.dto';
import {
  vaultsExample,
  vaultLatestMetricsExample,
  vaultLatestMetricsRangeExample,
  vaultAprSmaForDaysExample,
  zeroVaultAprSmaForDaysExample,
  vaultExample,
  vaultsOverviewExample,
} from './example';

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
  @CacheTTL(10 * 1000)
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
    status: HttpStatus.OK,
    description: 'Vaults list with latest state',
    schema: {
      example: vaultsExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The "address" must be provided when "role" is specified.',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Address must be an Ethereum address',
    type: ErrorResponseType,
  })
  async getVaultsByRoleAndAddress(
    @Query('limit', new DefaultValuePipe(limitQueryDefault), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(offsetQueryDefault), ParseIntPipe) offset: number,
    @Query('sortBy', new DefaultValuePipe(defaultSortBy), new ParseEnumPipe(SortFieldsEnum)) sortBy: SortFieldsEnum,
    @Query('direction', new DefaultValuePipe(defaultDirection), new ParseEnumPipe(DirectionEnum))
    direction: DirectionEnum,
    @Query('address', new ToChecksumEthAddressPipe(false)) address: string,
    @Query('role') role: string,
  ) {
    const hasRole = !!role;
    const hasAddress = !!address;
    if (hasRole && !hasAddress) {
      throw new BadRequestException('"address" must be provided when "role" is specified.');
    }

    const additionalParams = hasAddress && hasRole ? [address, role] : hasAddress ? [address] : [];

    const { lastReportMeta, totalVaults, vaults } = await this.vaultDbService.getVaultsWithRoleAndSortingAndReportData(
      limit,
      offset,
      sortBy,
      direction,
      ...additionalParams,
    );

    return {
      nextUpdateAt: this.getNextVaultsHourlyUpdate(),
      lastReportMeta,
      total: totalVaults,
      data: vaults,
    };
  }

  @Version('1')
  @Get(':vaultAddress')
  @CacheTTL(10 * 1000)
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vault data with last report data',
    schema: {
      example: vaultExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Address must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault not found',
    type: ErrorResponseType,
  })
  async getVaultByAddress(@Param('vaultAddress', new ToChecksumEthAddressPipe()) vaultAddress: string) {
    const vault = await this.vaultDbService.getVaultData(vaultAddress);
    if (!vault) {
      // Return 400 (not 404) to keep the API behavior consistent with other endpoints
      throw new BadRequestException('Vault not found');
    }
    return vault;
  }

  @Version('1')
  @Get(':vaultAddress/latest-metrics')
  @CacheTTL(10 * 1000)
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vault with latest metrics',
    schema: {
      example: vaultLatestMetricsExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Address must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault not found',
    type: ErrorResponseType,
  })
  async getLatestVaultStatsByAddress(@Param('vaultAddress', new ToChecksumEthAddressPipe()) vaultAddress: string) {
    const latestStats = await this.vaultDbService.getLatestVaultReportStats(vaultAddress);
    if (!latestStats) {
      throw new BadRequestException('Vault not found');
    }

    return latestStats;
  }

  @Version('1')
  @Get(':vaultAddress/metrics-range')
  @CacheTTL(10 * 1000)
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiQuery({ name: 'fromTimestamp', required: false, type: Number })
  @ApiQuery({ name: 'toTimestamp', required: false, type: Number })
  @ApiQuery({ name: 'fromBlock', required: false, type: Number })
  @ApiQuery({ name: 'toBlock', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vaults with latest metrics',
    schema: {
      example: vaultLatestMetricsRangeExample,
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Address must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'You must provide either both "fromBlock" & "toBlock" or both "fromTimestamp" & "toTimestamp".',
    type: ErrorResponseType,
  })
  async getVaultStatsRangeByAddress(
    @Param('vaultAddress', new ToChecksumEthAddressPipe()) vaultAddress: string,
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

  @Version('1')
  @Get(':vaultAddress/apr/sma')
  @CacheTTL(10 * 1000)
  @ApiParam({ name: 'vaultAddress', type: String, description: 'Vault address (0x...)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Simple Moving Average APR for last 7 days for vault',
    schema: {
      oneOf: [{ example: vaultAprSmaForDaysExample }, { example: zeroVaultAprSmaForDaysExample }],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Address must be an Ethereum address',
    type: ErrorResponseType,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vault not found',
    type: ErrorResponseType,
  })
  async getVaultAprSmaForDays(@Param('vaultAddress', new ToChecksumEthAddressPipe()) vaultAddress: string) {
    const data = await this.vaultDbService.getVaultAprSmaForDays(vaultAddress, VAULT_APR_SMA_DAYS);
    if (!data) {
      throw new BadRequestException('Vault not found');
    }

    return data;
  }

  @Version('1')
  @Get('overview')
  @CacheTTL(10 * 1000)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vaults overview (TVL, vaults count)',
    schema: {
      example: vaultsOverviewExample,
    },
  })
  async getVaultsOverview() {
    const [totalVaults, tvl] = await Promise.all([
      this.vaultDbService.getVaultsCount({ isDisconnected: false }),
      this.vaultDbService.getTvl(),
    ]);

    return {
      totalVaults,
      tvlWei: tvl.tvlWei,
      updatedAt: tvl.updatedAt,
    };
  }

  private getNextVaultsHourlyUpdate(): Date {
    const options = { currentDate: new Date(), tz: this.configService.jobs['vaultsCronTZ'] };
    const interval = CronExpressionParser.parse(this.configService.jobs['vaultsCron'], options);
    return interval.next().toDate();
  }
}

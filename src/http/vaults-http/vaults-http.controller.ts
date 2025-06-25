import { CronExpressionParser } from 'cron-parser';
import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseEnumPipe,
  ParseIntPipe,
  Version,
  Inject,
  LoggerService,
  BadRequestException,
} from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { VaultsService } from 'vault';
import { VaultsQueryService, SortFieldsEnum, DirectionEnum } from 'vaults-query';
import { VaultsStateHourlyService } from 'vaults-state-hourly';
import { ALL_ROLE_VALUES } from 'vault-member';

import { vaultsExample } from './example';

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
    private readonly vaultsService: VaultsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
    private readonly vaultsQueryService: VaultsQueryService,
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
    description: 'Vaults with latest state metrics',
    schema: {
      example: vaultsExample,
    },
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

    const vaults = await this.vaultsQueryService.getVaults(
      limit,
      offset,
      sortBy,
      direction,
      ...(hasRole && hasAddress ? [role, address] : [])
    );

    return {
      nextUpdateAt: this.getNextVaultsHourlyUpdate(),
      vaults,
    };
  }

  private getNextVaultsHourlyUpdate(): Date {
    const options = { currentDate: new Date(), tz: this.configService.jobs['vaultsHourlyCronTZ'] };
    const interval = CronExpressionParser.parse(this.configService.jobs['vaultsHourlyCron'], options);
    return interval.next().toDate();
  }
}

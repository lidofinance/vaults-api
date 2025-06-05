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
} from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { VaultsService } from '../../vault';
import { VaultsStateHourlyService } from '../../vaults-state-hourly';
import { SortFieldsEnum } from '../../vaults-state-hourly/sort-fields.enum';

import { DirectionEnum } from '../../vaults-state-hourly/direction.enum';
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
  @ApiResponse({
    status: 200,
    description: 'Vaults with latest state metrics',
    schema: {
      example: vaultsExample,
    },
  })
  async getVaults(
    @Query('limit', new DefaultValuePipe(limitQueryDefault), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(offsetQueryDefault), ParseIntPipe) offset: number,
    @Query('sortBy', new DefaultValuePipe(defaultSortBy), new ParseEnumPipe(SortFieldsEnum)) sortBy: SortFieldsEnum,
    @Query('direction', new DefaultValuePipe(defaultDirection), new ParseEnumPipe(DirectionEnum))
    direction: DirectionEnum,
  ) {
    const vaults = await this.vaultsStateHourlyService.getVaultsSorted(limit, offset, sortBy, direction);
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

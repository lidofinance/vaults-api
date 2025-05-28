import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe, Version, Inject, LoggerService } from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { VaultsService } from '../../vault';
import { VaultsStateHourlyService } from '../../vaults-state-hourly';
import { vaultsExample } from './example';

const limitQueryDefault = 10;
const offsetQueryDefault = 10;

@Controller('vaults')
@ApiTags('Vaults')
export class VaultsHttpController {
  constructor(
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
    description: 'Offset from the beginning of the vault list',
  })
  @ApiResponse({
    status: 200,
    description: 'Vaults with current state metrics',
    schema: {
      example: vaultsExample,
    },
  })
  async getVaults(
    @Query('limit', new DefaultValuePipe(limitQueryDefault), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(offsetQueryDefault), ParseIntPipe) offset: number,
  ) {
    const vaults = await this.vaultsService.getVaults(limit, offset);
    const addresses = vaults.map((v) => v.address);

    const latestVaultsHourlyStates = await this.vaultsStateHourlyService.getLastByVaultAddresses(addresses);
    return latestVaultsHourlyStates.map((item) => ({
      ...item,
      // TODO: handler on the sql side?
      healthFactor: item.healthFactor === Infinity ? 'Infinity' : item.healthFactor,
    }));
  }
}

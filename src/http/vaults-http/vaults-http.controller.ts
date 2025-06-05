import { CronExpressionParser } from 'cron-parser';
import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe, Version, Inject, LoggerService } from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { ConfigService } from 'common/config';
import { ALL_ROLE_VALUES } from '../../vault-member/vault-member.constants';
import { VaultsService } from '../../vault';
import { VaultsStateHourlyService } from '../../vaults-state-hourly';
import { VaultsMemberService } from '../../vault-member';
import { vaultsExample } from './example';

const limitQueryDefault = 10;
const offsetQueryDefault = 0;

@Controller('vaults')
@ApiTags('Vaults')
export class VaultsHttpController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    private readonly vaultsService: VaultsService,
    private readonly vaultsStateHourlyService: VaultsStateHourlyService,
    private readonly vaultsMemberService: VaultsMemberService,
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
    return {
      nextUpdateAt: this.getNextVaultsHourlyUpdate(),
      vaults: latestVaultsHourlyStates.map((item) => ({
        ...item,
        // TODO: @Transform?
        healthFactor: item.healthFactor === Infinity ? 'Infinity' : item.healthFactor,
      })),
    };
  }

  @Version('1')
  @Get('/by-role-and-address')
  @ApiQuery({
    name: 'role',
    required: true,
    enum: ALL_ROLE_VALUES,
    enumName: 'RoleOptions',
    description: 'Role constant string. Must be one of the allowed values.',
  })
  @ApiQuery({
    name: 'address',
    required: true,
    type: String,
    description: 'Account address to filter vaults by',
  })
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
  async getVaultsByRoleAndAddress(
    @Query('role') role: string,
    @Query('address') address: string,
    @Query('limit', new DefaultValuePipe(limitQueryDefault), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(offsetQueryDefault), ParseIntPipe) offset: number,
  ) {
    const vaultAddresses = await this.vaultsMemberService.getVaultAddressesByRoleAndAddress(
      role,
      address,
      limit,
      offset,
    );

    const latestVaultsHourlyStates = await this.vaultsStateHourlyService.getLastByVaultAddresses(vaultAddresses);
    return {
      nextUpdateAt: this.getNextVaultsHourlyUpdate(),
      vaults: latestVaultsHourlyStates.map((item) => ({
        ...item,
        // TODO: @Transform?
        healthFactor: item.healthFactor === Infinity ? 'Infinity' : item.healthFactor,
      })),
    };
  }

  private getNextVaultsHourlyUpdate(): Date {
    const options = { currentDate: new Date(), tz: this.configService.jobs['vaultsHourlyCronTZ'] };
    const interval = CronExpressionParser.parse(this.configService.jobs['vaultsHourlyCron'], options);
    return interval.next().toDate();
  }
}

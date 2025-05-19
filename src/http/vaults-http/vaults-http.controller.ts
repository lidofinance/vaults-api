import { Controller, Get, Query, ParseIntPipe, Version } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { VaultsService } from '../../vault/vault.service';

@Controller('vaults')
@ApiTags('Vaults')
export class VaultsHttpController {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    private readonly vaultsService: VaultsService,
  ) {}

  @Version('1')
  @Get('')
  @ApiResponse({
    status: 200,
    description: 'Last report data for a vault',
    // schema: {
    //   example: reportByVaultExample,
    // },
  })
  async getVaults(@Query('limit', ParseIntPipe) limit = 10, @Query('offset', ParseIntPipe) offset = 0) {
    return await this.vaultsService.getVaults(limit, offset);
  }
}

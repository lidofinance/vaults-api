import { Controller, Get, Param, Version, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
// import { BadRequestException } from '@nestjs/common';

import { LsvService } from 'lsv/lsv.service';
import {
  VaultHubContractService,
  // type LatestReportData,
} from 'common/contracts/modules/vault-hub-contract/vault-hub-contract.service';

@Controller('reports')
@ApiTags('Reports')
@UseInterceptors(ClassSerializerInterceptor)
export class ReportsController {
  constructor(private readonly lsvService: LsvService, private readonly vaultHubService: VaultHubContractService) {}

  @Version('1')
  @Get('/reports/:vault')
  @ApiResponse({
    status: 200,
    description: '<TOOO>',
  })
  async create(@Param('vault') vault: string) {
    console.log(vault);

    const report = await this.vaultHubService.getLatestReportData();
    console.log('report:', report);

    // const proof = await this.lsvService.createProof(validatorIndex);
    //
    // if (proof === VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR) {
    //   throw new BadRequestException(`Validator index ${validatorIndex} is out of range`);
    // }

    return 1;
  }
}

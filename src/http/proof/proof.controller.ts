import { Controller, Get, Param, Version } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';

import { LsvService, VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR } from 'lsv/lsv.service';
import { Proof } from './entities';

@Controller('proof')
@ApiTags('Proof')
export class ProofController {
  constructor(private readonly lsvService: LsvService) {}

  @Version('1')
  @Get('/make/:validatorIndex')
  @ApiResponse({
    status: 200,
    description: 'Made the proof',
    type: Proof,
  })
  async create(@Param('validatorIndex') validatorIndex: number) {
    const proof = await this.lsvService.createProof(validatorIndex);

    if (proof === VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR) {
      throw new BadRequestException(`Validator index ${validatorIndex} is out of range`);
    }

    // TODO: to be changed in future PRs
    return JSON.parse(JSON.stringify(proof, (_, value) => (typeof value === 'bigint' ? value.toString() : value)));
  }
}

import { plainToInstance } from 'class-transformer';
import { Controller, Get, Param, Version, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';

import { LsvService, VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR } from 'lsv/lsv.service';
import { ProofDto } from './dto';

@Controller('proof')
@ApiTags('Proof')
@UseInterceptors(ClassSerializerInterceptor)
export class ProofController {
  constructor(private readonly lsvService: LsvService) {}

  @Version('1')
  @Get('/make/:validatorIndex')
  @ApiResponse({
    status: 200,
    description: 'Made the proof',
    type: ProofDto,
  })
  async create(@Param('validatorIndex') validatorIndex: number) {
    const proof = await this.lsvService.createProof(validatorIndex);

    if (proof === VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR) {
      throw new BadRequestException(`Validator index ${validatorIndex} is out of range`);
    }

    return plainToInstance(ProofDto, proof);
  }
}

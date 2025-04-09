import { Controller, Get, Param, Version } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { LsvService } from 'lsv/lsv.service';
import { Proof } from './entities';

@Controller('proof')
@ApiTags('Proof')
export class ProofController {
  constructor(private readonly lsvService: LsvService) {}

  @Version('1')
  @Get('/create/:validatorIndex')
  @ApiResponse({
    status: 200,
    description: 'Created proof',
    type: Proof,
  })
  async create(@Param('validatorIndex') validatorIndex: number) {
    const proof = await this.lsvService.createProof(validatorIndex);
    // TODO: to be changed in future PRs
    return JSON.parse(JSON.stringify(proof, (_, value) => (typeof value === 'bigint' ? value.toString() : value)));
  }
}

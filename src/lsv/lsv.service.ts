import { Injectable } from '@nestjs/common';
import { createPDGProof } from '@lidofinance/lsv-cli/dist/utils';

import { ConfigService } from '../common/config';

@Injectable()
export class LsvService {
  constructor(protected readonly configService: ConfigService) {}

  async createProof(validatorIndex: number) {
    try {
      return await createPDGProof(validatorIndex, this.configService.get('CL_URL'));
    } catch (error) {
      console.error(`Failed to create PDG proof for validatorIndex ${validatorIndex}:`, error);
      throw error;
    }
  }
}

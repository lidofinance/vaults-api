import { Injectable } from '@nestjs/common';
import { createPDGProof } from '@lidofinance/lsv-cli/dist/utils';

import { ConfigService } from '../common/config';

export const VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR = 'VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR';

@Injectable()
export class LsvService {
  constructor(protected readonly configService: ConfigService) {}

  async createProof(validatorIndex: number) {
    try {
      return await createPDGProof(validatorIndex, this.configService.get('CL_URL'));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`ValidatorIndex ${validatorIndex} out of range`)) {
        console.warn(`[LsvService.createProof] Validator index ${validatorIndex} is out of range`);
        return VALIDATOR_INDEX_IS_OUT_OF_RANGE_ERROR;
      }

      console.error(`[LsvService.createProof] Failed to create PDG proof for validatorIndex ${validatorIndex}:`, error);
      throw error;
    }
  }
}

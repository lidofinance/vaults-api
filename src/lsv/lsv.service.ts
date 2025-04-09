import { Injectable } from '@nestjs/common';
import { createPDGProof } from '@lidofinance/lsv-cli/dist/utils';

@Injectable()
export class LsvService {
  async createProof(validatorIndex: number) {
    try {
      return await createPDGProof(validatorIndex);
    } catch (error) {
      console.error(`Failed to create PDG proof for validatorIndex ${validatorIndex}:`, error);
      throw error;
    }
  }
}

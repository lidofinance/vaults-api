import { IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportParamsDto {
  @ApiProperty({
    name: 'vaultAddress',
    type: String,
    // hoodie example
    example: '0x7228FC874C1D08cAE68a558d7B650fc4862B1DB7',
    description: 'Vault address',
  })
  @IsEthereumAddress()
  vaultAddress: `0x${string}`;
}

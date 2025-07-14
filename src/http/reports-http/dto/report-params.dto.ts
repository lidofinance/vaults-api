import { IsEthereumAddress, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportByVaultParamsDto {
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

export class ReportByCidAndVaultParamsDto {
  @ApiProperty({
    name: 'cid',
    type: String,
    // hoodie example
    example: 'QmfVbCvPxvZsfuSH1dNbtpbs6XLWszQ6nZ9EkujvLjNDco',
    description: 'IPFS CID',
  })
  @Matches(/^[Qm][1-9A-HJ-NP-Za-km-z]{44,}$/)
  cid: `0x${string}`;

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

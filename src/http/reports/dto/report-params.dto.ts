import { IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportParamsDto {
  @ApiProperty({
    name: 'vault',
    type: String,
    example: '0xE312f1ed35c4dBd010A332118baAD69d45A0E302',
    description: 'Vault address',
  })
  @IsEthereumAddress()
  vault: `0x${string}`;
}

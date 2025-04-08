import { ApiProperty } from '@nestjs/swagger';

export class Statistic {
  @ApiProperty({
    example: Number(Date.now()),
  })
  timestamp: number;

  @ApiProperty({
    required: false,
  })
  lidoLocatorContract?: string;
}

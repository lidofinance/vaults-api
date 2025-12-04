import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseType {
  @ApiProperty({
    description: 'Array of validation error messages',
  })
  message: string;

  @ApiProperty({
    description: 'Error text',
    example: 'Bad Request',
  })
  error: string;

  @ApiProperty({
    example: HttpStatus.BAD_REQUEST,
    description: 'Http status code',
  })
  statusCode: number;
}

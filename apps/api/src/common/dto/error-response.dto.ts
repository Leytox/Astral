import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Unauthorized' })
  message!: string;

  @ApiProperty({ example: 'UNAUTHORIZED', required: false })
  errorCode?: string;
}

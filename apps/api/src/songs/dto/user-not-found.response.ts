import { ApiProperty } from '@nestjs/swagger';

export class UserNotFoundError {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'User not found' })
  message: string;

  @ApiProperty({ example: 'USER_404' })
  errorCode: string;
}

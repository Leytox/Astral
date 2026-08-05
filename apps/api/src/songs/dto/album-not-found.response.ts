import { ApiProperty } from '@nestjs/swagger';

export class AlbumNotFoundError {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Album not found' })
  message: string;

  @ApiProperty({ example: 'ALBUM_404' })
  errorCode: string;
}

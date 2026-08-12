import { ApiProperty } from '@nestjs/swagger';

export class UploadResponse {
  @ApiProperty({
    example: '1dda3c69-cdb7-4986-8e8c-90c496deb66e',
  })
  id: string;

  @ApiProperty({ example: 'Song uploaded successfully' })
  message: string;
}

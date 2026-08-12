import { ApiProperty } from '@nestjs/swagger';

export class AddSongToPlaylistDto {
  @ApiProperty({
    description: 'ID of the song to add to the playlist',
    format: 'uuid',
    example: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  })
  songId!: string;
}

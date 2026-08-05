import { Controller, Get, Param } from '@nestjs/common';
import { SearchService } from './search.service';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SearchResponseDto } from './dto/search.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @ApiOperation({
    summary: 'Returns search results for the given title',
    description: 'Returns albums, songs, genres, users and playlists',
  })
  @ApiParam({
    name: 'title',
    description: 'The title to search for',
    example: 'Rock',
  })
  @ApiOkResponse({
    description: 'The search results',
    type: SearchResponseDto,
    isArray: true,
    example: [
      {
        type: 'genre',
        id: '4c6e2730-37ff-4914-b935-0ce721948aff',
        name: 'Math Rock',
        imageUrl: null,
      },
      {
        type: 'genre',
        id: 'd9be5438-9cc4-4fe1-b136-bc6599d07059',
        name: 'Gothic Rock',
        imageUrl: null,
      },
      {
        type: 'genre',
        id: 'a8d9f666-1ddc-4d4b-98ee-5b269db4f20e',
        name: 'Garage Rock',
        imageUrl: null,
      },
      {
        type: 'genre',
        id: '9ebcf3c7-2744-4280-a0c6-7e1a30b3584a',
        name: 'Psychedelic Rock',
        imageUrl: null,
      },
    ],
  })
  @Get(':title')
  async search(@Param('title') title: string) {
    return await this.searchService.search(title);
  }
}

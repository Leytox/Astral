import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateGenreDto } from './dto/create-genre.dto';
import { EditGenreDto } from './dto/edit-genre.dto';
import { GenreDto } from './dto/genre.dto';
import { GenresService } from './genres.service';

@ApiTags('Genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get genre',
    description: 'Get genre by id',
  })
  @ApiOkResponse({
    description: 'Genre retrieved successfully',
    type: GenreDto,
    example: {
      id: '53ad4a23-c032-4196-b32f-d5282ab59915',
      name: 'Rock',
      description:
        'Rock is a genre of music that originated in the United States and is characterized by its powerful, often aggressive sound.',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  @ApiNotFoundResponse({
    description: 'Genre not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the Genre',
  })
  @Get(':id')
  async getGenre(@Param('id') id: string) {
    return await this.genresService.getGenre(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all genres',
    description: 'Get all genres with pagination',
  })
  @ApiOkResponse({
    description: 'Genres retrieved successfully',
    type: 'object',
    example: {
      genres: [
        {
          id: '96170c54-a5f5-4256-9dc7-5aad543176ca',
          name: 'Rock',
          description:
            'Rock is a genre of music that originated in the United States and is characterized by its powerful, often aggressive sound.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '669a5858-31d9-4552-9b96-ce3d3bd652af',
          name: 'Pop',
          description:
            'Pop is a genre of music that originated in the United States and is characterized by its catchy, melodic sound.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cbab89bb-236d-43a1-b9ec-d0147a125e9a',
          name: 'Hip Hop',
          description:
            'Hip Hop is a genre of music that originated in the United States and is characterized by its rhythmic, electronic sound.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      count: 3,
    },
  })
  @ApiNotFoundResponse({
    description: 'Genres not found',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: 0,
    description: 'Number of records to skip',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Maximum number of records to return',
  })
  @Get()
  async getGenres(@Query() query: PaginationDto) {
    return await this.genresService.getGenres(query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only ADMIN users can perform this action',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Create a new genre',
    description: 'Create a new genre with the provided name',
  })
  @ApiConflictResponse({
    description: 'Genre with this name is already exists',
  })
  @ApiCreatedResponse({
    description: 'Genre was successfully created',
    type: MessageResponseDto,
  })
  @Post()
  async createGenre(@Body() body: CreateGenreDto) {
    return await this.genresService.createGenre(body);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only ADMIN users can perform this action',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Edit a genre',
  })
  @ApiConflictResponse({
    description: 'Genre with this name is already exists',
  })
  @ApiOkResponse({
    description: 'Genre was edited successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Genre not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the Genre',
  })
  @Patch(':id')
  async editGenre(@Body() body: EditGenreDto, @Param('id') id: string) {
    return await this.genresService.editGenre(body, id);
  }
}

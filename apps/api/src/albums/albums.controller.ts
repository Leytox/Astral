import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { User } from '../common/decorators/user.decorator';
import type { AccessJwtPayload } from '@repo/types';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { EditAlbumDto } from './dto/edit-album.dto';
import { AlbumDto } from './dto/album.dto';
import { Album } from '../generated/prisma/client';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional-access.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Albums')
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get album',
    description: 'Get an album by its ID',
  })
  @ApiOkResponse({
    type: AlbumDto,
    example: {
      id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
      title: 'Album Title',
      cover: 'http://dummyimage.com/185x100.png/ff4444/ffffff',
      userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
      releaseDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      songs: [
        {
          id: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
          title: 'Song Title',
          albumId: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
          genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
          duration: 168,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '5c1285b1-d2cc-4f42-9d25-4a99bdeb9ae4',
          title: 'Song Title',
          albumId: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
          genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
          duration: 160,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiParam({ name: 'id', description: 'Album ID' })
  @Get(':id')
  async getAlbum(@Param('id') id: string): Promise<Album> {
    return await this.albumsService.getAlbum(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiConsumes('multipart/form-data')
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Update an album cover',
    description: 'Update the cover image of an album',
  })
  @ApiOkResponse({
    description: 'The album cover has been successfully updated',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The cover image of the album',
        },
      },
      required: ['file'],
    },
  })
  @ApiParam({
    name: 'id',
    description: 'Album ID',
  })
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 * 10 },
    }), // 10MB
  )
  async updateAlbumCover(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'image/jpeg|image/png|image/webp',
          errorMessage:
            'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 10,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @User() user: AccessJwtPayload,
  ) {
    return await this.albumsService.updateAlbumCover(file, id, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiConsumes('multipart/form-data')
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Create a new album',
    description: 'Create a new album with a cover image',
  })
  @ApiCreatedResponse({
    description: 'The album has been successfully created',
    type: MessageResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The cover image of the album',
        },
        title: {
          type: 'string',
          example: 'Alpha',
          description: 'The title of the album',
        },
        releaseDate: {
          type: 'string',
          format: 'date',
          example: '2011-03-04',
          description: 'The release date of the album',
        },
      },
      required: ['file', 'title', 'releaseDate'],
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 * 10 },
    }), // 10MB
  )
  async createAlbum(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'image/jpeg|image/png|image/webp',
          errorMessage:
            'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 10,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @User() user: AccessJwtPayload,
    @Body() body: CreateAlbumDto,
  ) {
    return await this.albumsService.createAlbum(body, file, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Search albums by title',
    description: 'Search albums by title with pagination',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOkResponse({
    description: 'List of albums',
    type: AlbumDto,
    example: [
      {
        id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
        title: 'Album Title',
        cover: 'http://dummyimage.com/185x100.png/ff4444/ffffff',
        userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
        releaseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        songs: [
          {
            id: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
            title: 'Song Title',
            albumId: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
            genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
            duration: 168,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '5c1285b1-d2cc-4f42-9d25-4a99bdeb9ae4',
            title: 'Song Title',
            albumId: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
            genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
            duration: 160,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      {
        id: '93e8f66e-61a4-46f2-b589-d8eb7bc73575',
        title: 'Album Title #2',
        cover: 'http://dummyimage.com/185x100.png/ff4444/ffffff',
        userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
        releaseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        songs: [
          {
            id: '301fee99-1afe-4208-9e93-f31dc2e23a4c',
            title: 'Song Title',
            albumId: '93e8f66e-61a4-46f2-b589-d8eb7bc73575',
            genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
            duration: 168,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'd31281d6-2232-4368-bac2-c227d2e80fea',
            title: 'Song Title',
            albumId: '93e8f66e-61a4-46f2-b589-d8eb7bc73575',
            genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
            duration: 160,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ],
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
  @ApiParam({
    name: 'title',
    description: 'The title to search for',
    example: 'Best 2026 hip-hop tracks',
  })
  @Get('search/:title')
  async getAlbums(
    @Param('title') title: string,
    @Query() query: PaginationDto,
  ) {
    return await this.albumsService.getAlbums(title, query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Edit an album' })
  @ApiOkResponse({
    description: 'Album updated successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Album ID',
    type: 'string',
  })
  @ApiBody({
    description: 'Album data to update',
    type: EditAlbumDto,
  })
  @Patch(':id')
  async editAlbum(
    @Param('id') id: string,
    @Body() body: EditAlbumDto,
    @User() user: AccessJwtPayload,
  ) {
    return await this.albumsService.editAlbum(id, body, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Get all liked albums',
    description:
      'Returns a list of all albums liked by the authenticated user.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOkResponse({
    description: 'List of liked albums',
    type: 'object',
    example: {
      count: 10,
      albums: [
        {
          id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
          title: 'Album Title',
          cover: 'http://dummyimage.com/185x100.png/ff4444/ffffff',
          userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
          releaseDate: '2026-08-01T00:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    },
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
  async getLikedAlbums(
    @User() user: AccessJwtPayload,
    @Query() query: PaginationDto,
  ) {
    return await this.albumsService.getLikedAlbums(user.sub, query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Like an album',
    description: 'Likes an album for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Album liked successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Album ID',
  })
  @Post(':id/like')
  async likeAlbum(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.albumsService.likeAlbum(id, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Unlike an album',
    description: 'Unlikes an album for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Album unliked successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Album ID',
  })
  @Delete(':id/like')
  async unlikeAlbum(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.albumsService.unlikeAlbum(id, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Delete an album' })
  @ApiOkResponse({
    description: 'Album deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Album not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Album ID',
  })
  @Delete(':id')
  async deleteAlbum(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.albumsService.deleteAlbum(id, user.sub);
  }
}

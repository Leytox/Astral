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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  Headers,
  UseInterceptors,
  HttpCode,
  Query,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPartialContentResponse,
  ApiProduces,
  ApiQuery,
  ApiRequestedRangeNotSatisfiableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { UploadSongDto } from './dto/upload.dto';
import { EditSongDto } from './dto/edit.dto';
import type { Response } from 'express';
import { type AccessJwtPayload, type AudioQuality } from '@repo/types';
import { User } from '../common/decorators/user.decorator';
import { tmpdir } from 'os';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { SkipThrottle } from '@nestjs/throttler';
import { PlayUrlDto } from './dto/play-url.response';
import { UploadSongResponseDto } from './dto/upload-response';

@ApiTags('Songs')
@ApiExtraModels(ErrorResponseDto)
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Get a presigned streaming URL',
    description: 'Get a presigned streaming URL for a song with expiring time',
  })
  @ApiOkResponse({
    description: 'Presigned streaming URL retrieved successfully',
    type: PlayUrlDto,
  })
  @ApiQuery({
    name: 'quality',
    enum: ['low', 'medium', 'high', 'lossless'],
    required: false,
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the song to get the play URL for',
    required: true,
    type: String,
    example: 'b3c96090-0716-462a-a33a-06087f2a9c1b',
  })
  @Get(':id/play-url')
  async getPlayUrl(
    @Param('id') id: string,
    @Query('quality') quality: AudioQuality,
  ) {
    return await this.songsService.getPlayUrl(id, quality);
  }

  @SkipThrottle()
  @Get(':id/play')
  @ApiOperation({
    summary: 'Get a song',
    description: 'Get chunks of a song',
    deprecated: true,
  })
  @ApiProduces('audio/mp4', 'audio/flac')
  @ApiParam({
    name: 'id',
    description: 'The ID of the song to play',
    required: true,
    type: String,
    example: '9c523666-e359-4c4b-a49a-263cc7c3fdd9',
  })
  @ApiHeader({
    name: 'range',
    description: 'The range of the song to play',
    required: true,
    schema: { type: 'string', example: 'bytes=0-1024' },
  })
  @ApiPartialContentResponse({
    description: 'The song chunk',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiRequestedRangeNotSatisfiableResponse({
    description: 'The requested range is not satisfiable',
  })
  @ApiNotFoundResponse({
    description: 'Song was not found',
  })
  @ApiQuery({
    name: 'quality',
    description: 'The quality of the song to play',
    required: false,
    type: String,
    enum: ['low', 'medium', 'high', 'lossless'],
    default: 'medium',
  })
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async play(
    @Param('id') id: string,
    @Headers('range') range: string,
    @Res({ passthrough: true }) res: Response,
    @Query('quality') quality: AudioQuality,
  ): Promise<StreamableFile> {
    return await this.songsService.play(id, range, res, quality);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiConsumes('multipart/form-data')
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Upload a song',
    description: 'Upload a song in flac/wav format',
  })
  @ApiNotFoundResponse({
    content: {
      'application/json': {
        examples: {
          albumNotFound: {
            summary: 'Album not found',
            value: {
              message: 'No Album exists with this ID',
              errorCode: 'ALBUM_404',
            },
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Song already exists in the Album',
  })
  @ApiCreatedResponse({
    description: 'Song uploaded successfully',
    type: UploadSongResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid file type',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The song file to upload (flac/wav format)',
        },
        title: {
          type: 'string',
          description: 'The track title',
          example: 'Moonlight Sonata: Movement 1',
        },
        albumId: {
          type: 'string',
          format: 'uuid',
          description: 'The album id',
          example: '93c908b3-310e-4eda-aedc-55923a2a09c3',
        },
        genreId: {
          type: 'string',
          format: 'uuid',
          description: 'The track genre id',
          example: 'ff1d1f19-c04d-44d6-9ab3-9b3bc007b7f6',
        },
        duration: {
          type: 'number',
          description: 'The track duration in seconds',
          example: 360,
        },
      },
      required: ['file', 'title', 'albumId', 'genreId', 'duration'],
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
      }),
      limits: { fileSize: 1024 * 1024 * 100 },
    }), // 100MB
  )
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 100, // 100 Mb
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @User() user: AccessJwtPayload,
    @Body() body: UploadSongDto,
  ) {
    return await this.songsService.upload(file, user, body);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Edit a song', description: 'Change song details' })
  @ApiOkResponse({
    description: 'Song updated successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Song was not found',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the song to edit',
  })
  @ApiBody({
    type: EditSongDto,
  })
  @Patch(':id')
  async edit(
    @Param('id') id: string,
    @Body() body: EditSongDto,
    @User() user: AccessJwtPayload,
  ) {
    return await this.songsService.edit(id, body, user);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Like a song',
    description:
      'Adding selected song to the list of liked for the current user',
  })
  @ApiOkResponse({
    description: 'Song was successfully added to liked',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Song was not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the Song',
  })
  @Post(':id/like')
  async like(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.songsService.like(id, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Unlike a song',
    description:
      'Removing selected song from the list of liked for the current user',
  })
  @ApiOkResponse({
    description: 'Song was removed from liked',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Song was not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the Song',
  })
  @Delete(':id/like')
  async unlike(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.songsService.unlike(id, user.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @Get('liked')
  @ApiOperation({
    summary: 'Get liked songs',
    description: 'Retrieves a list of liked songs for the current user.',
  })
  @ApiOkResponse({
    description: 'Liked songs retrieved successfully',
    type: 'object',
    example: {
      count: 10,
      songs: [
        {
          id: 'b3c96090-0716-462a-a33a-06087f2a9c1b',
          title: 'Moonlight Sonata: Movement 1',
          albumId: '93c908b3-310e-4eda-aedc-55923a2a09c3',
          genreId: 'ff1d1f19-c04d-44d6-9ab3-9b3bc007b7f6',
          duration: 360,
          createdAt: '2026-08-01T12:00:00.000Z',
          updatedAt: '2026-08-01T12:00:00.000Z',
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
  async getLiked(
    @User() user: AccessJwtPayload,
    @Query() query: PaginationDto,
  ) {
    return await this.songsService.getLiked(user.sub, query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Delete a song' })
  @ApiOkResponse({
    description: 'Song deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Song was not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the Song',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @User() user: AccessJwtPayload) {
    return await this.songsService.delete(id, user.sub);
  }
}

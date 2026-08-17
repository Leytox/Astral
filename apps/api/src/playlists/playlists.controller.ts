import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccessJwtPayload } from '@repo/types';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional-access.guard';
import { User } from '../common/decorators/user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AddSongToPlaylistDto } from './dto/add-song-to-playlist.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { EditPlaylistDto } from './dto/edit-playlist.dto';
import { PlaylistDto } from './dto/playlist.dto';
import { PlaylistsService } from './playlists.service';

@ApiTags('Playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Get current user playlists',
    description: 'Get playlists for the current user',
  })
  @ApiOkResponse({
    description: 'Playlists retrieved successfully',
    type: 'object',
    example: {
      playlists: [
        {
          id: '0829f8fa-4a91-463e-a19b-2aea1be7018a',
          name: 'just4me',
          isPublic: false,
          userId: '83fb361c-776b-412b-b6fa-f78732e98bf6',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '002cea60-55d0-4265-a9df-779bb6f665b6',
          name: '4all',
          isPublic: true,
          userId: '83fb361c-776b-412b-b6fa-f78732e98bf6',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      count: 2,
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Playlists not found',
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
  async getAllPlaylists(
    @User() user: AccessJwtPayload,
    @Query() query: PaginationDto,
  ) {
    return await this.playlistsService.getAllPlaylists(user.sub, query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get playlist by id',
    description: 'Get a playlist by its id',
  })
  @ApiOkResponse({
    type: PlaylistDto,
    example: {
      id: '002cea60-55d0-4265-a9df-779bb6f665b6',
      name: 'just4me',
      isPublic: false,
      userId: '83fb361c-776b-412b-b6fa-f78732e98bf6',
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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  @ApiNotFoundResponse({
    description: 'Playlist not found',
  })
  @ApiBadRequestResponse({
    description: 'Playlist is private',
  })
  @Get(':id')
  async getPlaylistById(
    @User() user: AccessJwtPayload | undefined,
    @Param('id') id: string,
  ) {
    return await this.playlistsService.getPlaylistById(user?.sub, id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Create playlist',
    description: 'Create a new playlist for current user',
  })
  @ApiOkResponse({
    description: 'Playlist created successfully',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'You already have a playlist with the same name',
  })
  @ApiBody({
    type: CreatePlaylistDto,
  })
  @Post()
  async createPlaylist(
    @Body() createPlaylistDto: CreatePlaylistDto,
    @User() user: AccessJwtPayload,
  ) {
    return await this.playlistsService.createPlaylist(
      createPlaylistDto,
      user.sub,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Add track to playlist',
    description: 'Add a track to an existing playlist',
  })
  @ApiOkResponse({
    description: 'Track added to playlist successfully',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Playlist was not found',
  })
  @ApiBody({
    description: 'The song to add to the playlist',
    type: AddSongToPlaylistDto,
  })
  @ApiParam({
    name: 'id',
    description: 'id of the playlist',
  })
  @Post(':id')
  async addTrackToPlaylist(
    @Param('id') playlistId: string,
    @Body() body: AddSongToPlaylistDto,
    @User() user: AccessJwtPayload,
  ) {
    return await this.playlistsService.addTrackToPlaylist(
      body.songId,
      playlistId,
      user.sub,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Remove track from playlist',
    description: 'Remove a track from an existing playlist',
  })
  @ApiOkResponse({
    description: 'Track removed from playlist successfully',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Track not found in this playlist',
  })
  @ApiParam({
    name: 'id',
    description: 'id of the playlist',
  })
  @ApiParam({
    name: 'songId',
    description: 'id of the song to remove',
  })
  @Delete(':id/tracks/:songId')
  async removeTrackFromPlaylist(
    @Param('id') playlistId: string,
    @Param('songId') songId: string,
    @User() user: AccessJwtPayload,
  ) {
    return await this.playlistsService.removeTrackFromPlaylist(
      songId,
      playlistId,
      user.sub,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Update a playlist',
    description: 'Update a playlist details',
  })
  @ApiOkResponse({
    description: 'Playlist updated successfully',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'You already have a playlist with the same name',
  })
  @ApiNotFoundResponse({
    description: 'Playlist not found',
  })
  @Patch(':id')
  async updatePlaylist(
    @Param('id') playlistId: string,
    @Body() updatePlaylistDto: EditPlaylistDto,
    @User() user: AccessJwtPayload,
  ) {
    return await this.playlistsService.updatePlaylist(
      playlistId,
      user.sub,
      updatePlaylistDto,
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: 'Delete a playlist',
    description: 'Delete a playlist',
  })
  @ApiOkResponse({
    description: 'Playlist deleted successfully',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Playlist was not found',
  })
  @Delete(':id')
  async deletePlaylist(
    @Param('id') playlistId: string,
    @User() user: AccessJwtPayload,
  ) {
    return await this.playlistsService.deletePlaylist(playlistId, user.sub);
  }
}

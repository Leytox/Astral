import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { EditPlaylistDto } from './dto/edit-playlist.dto';
import { Playlist } from '../generated/prisma/client';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly db: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /** Get all playlists for a user.
   * @async
   * @param id - User ID
   * @param query - Pagination query
   * @returns {Promise<{ playlists: Playlist[]; count: number }>} List of playlists
   */
  async getAllPlaylists(
    id: string,
    query: PaginationDto,
  ): Promise<{ playlists: Playlist[]; count: number }> {
    const limit = Number(query.limit) || 20;
    const offset = Number(query.offset) || 0;

    const [playlists, count] = await Promise.all([
      this.db.playlist.findMany({
        where: { userId: id },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.playlist.count({ where: { userId: id } }),
    ]);

    const result = { playlists, count };

    return result;
  }

  /** Get a playlist by id, if user is unauthorized, the playlist must be public.
   * @async
   * @param userId - User ID
   * @param id - Playlist ID
   * @returns {Promise<Playlist>} Playlist
   */
  async getPlaylistById(
    userId: string | undefined,
    id: string,
  ): Promise<Playlist> {
    const cacheKey = `playlists:detail:${id}`;
    const cachedPlaylist = await this.cacheManager.get<Playlist>(cacheKey);
    if (cachedPlaylist) return cachedPlaylist;

    const playlist = await this.db.playlist.findUnique({
      where: {
        id,
      },
      include: {
        songs: true,
      },
    });
    if (!playlist) throw new NotFoundException('Playlist was not found');
    if (!playlist.isPublic && userId !== playlist.userId)
      throw new BadRequestException('Playlist is private');

    await this.cacheManager.set(cacheKey, playlist, 180_000);
    return playlist;
  }

  /** Create a new playlist
   * @async
   * @param createPlaylistDto - Create playlist DTO
   * @param userId - User ID
   * @returns {Promise<MessageResponseDto>} message response DTO
   */
  async createPlaylist(
    createPlaylistDto: CreatePlaylistDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    const existingPlaylist = await this.db.playlist.findFirst({
      where: {
        userId,
        name: createPlaylistDto.name,
      },
    });
    if (existingPlaylist)
      throw new BadRequestException(
        'You already have a playlist with the same name',
      );
    await this.db.playlist.create({
      data: {
        userId,
        name: createPlaylistDto.name,
        isPublic: createPlaylistDto.isPublic,
      },
    });
    return { message: 'Playlist created successfully' };
  }

  /** Add track to a playlist by an id
   * @async
   * @param songId - Song ID
   * @param playlistId - Playlist ID
   * @param userId - User ID
   * @returns {Promise<MessageResponseDto>} message response DTO
   */
  async addTrackToPlaylist(
    songId: string,
    playlistId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const playlist = await this.getPlaylistById(userId, playlistId);
    const song = await this.db.song.findUnique({
      where: { id: songId },
    });
    if (!song) throw new NotFoundException('Song not found');
    await this.db.playlist.update({
      where: { id: playlist.id },
      data: {
        songs: { create: { songId } },
      },
    });
    await this.cacheManager.del(`playlists:detail:${playlistId}`);
    return { message: 'Track added to playlist successfully' };
  }

  /** Remove track from a playlist by an id
   * @async
   * @param songId - Song ID
   * @param playlistId - Playlist ID
   * @param userId - User ID
   * @returns {Promise<MessageResponseDto>} message response DTO
   */
  async removeTrackFromPlaylist(
    songId: string,
    playlistId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    await this.getPlaylistById(userId, playlistId);
    const playlistSong = await this.db.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId, songId },
      },
    });
    if (!playlistSong)
      throw new NotFoundException('Track not found in this playlist');

    await this.db.playlistSong.delete({
      where: { id: playlistSong.id },
    });

    await this.cacheManager.del(`playlists:detail:${playlistId}`);

    return { message: 'Track removed from playlist successfully' };
  }

  /** Add track to a playlist by an id
   * @async
   * @param id - Playlist ID
   * @param userId - User ID
   * @param updatePlaylistDto - Edit playlist DTO
   * @returns {Promise<MessageResponseDto>} message response DTO
   */
  async updatePlaylist(
    id: string,
    userId: string,
    updatePlaylistDto: EditPlaylistDto,
  ): Promise<MessageResponseDto> {
    const existingPlaylist = await this.db.playlist.findFirst({
      where: { name: updatePlaylistDto.name, userId },
    });
    if (existingPlaylist && existingPlaylist.id !== id)
      throw new BadRequestException(
        'You already have a playlist with the same name',
      );
    await this.db.playlist.update({
      where: { id },
      data: {
        name: updatePlaylistDto.name,
        isPublic: updatePlaylistDto.isPublic,
      },
    });
    await this.cacheManager.del(`playlists:detail:${id}`);
    return { message: 'Playlist updated successfully' };
  }

  /** Delete a playlist by an id
   * @async
   * @param id - Playlist ID
   * @param userId - User ID
   * @returns {Promise<MessageResponseDto>} message response DTO
   */
  async deletePlaylist(
    id: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const playlist = await this.getPlaylistById(userId, id);
    await this.db.playlist.delete({
      where: { id: playlist.id },
    });

    const cacheKey = `playlists:detail:${id}`;
    await this.cacheManager.del(cacheKey);

    return { message: 'Playlist deleted successfully' };
  }
}

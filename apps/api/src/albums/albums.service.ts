import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UploadService } from '../upload/upload.service';
import { EditAlbumDto } from './dto/edit-album.dto';
import { SongsService } from '../songs/songs.service';
import { InjectS3, type S3 } from 'nestjs-s3';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Album } from '../generated/prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PresignService } from '../upload/presign.service';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly db: PrismaService,
    private readonly uploadService: UploadService,
    private readonly songsService: SongsService,
    private readonly presignService: PresignService,
    @InjectS3() private readonly s3: S3,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /** Get albums by title with pagination
   * @param title - The title to search for
   * @param query - Pagination query parameters
   * @returns {Promise<Album[]>} A list of albums matching the title and pagination criteria
   */
  async getAlbums(
    title: string,
    query: PaginationDto,
  ): Promise<{ albums: Album[]; count: number }> {
    const limit = Number(query.limit) || 10;
    const offset = Number(query.offset) || 0;

    const [albums, countResult] = await Promise.all([
      this.db.$queryRaw<Album[]>`
         SELECT id, title, "releaseDate", "createdAt", "updatedAt", "userId"
         FROM "Album"
         WHERE title % ${title}::text
         ORDER BY similarity(title, ${title}::text) DESC
         LIMIT ${limit} OFFSET ${offset}`,
      this.db.$queryRaw<[{ count: bigint }]>`
         SELECT COUNT(*)::int AS count
         FROM "Album"
         WHERE title % ${title}::text`,
    ]);

    const count = Number(countResult[0]?.count ?? 0);

    const result = { albums, count };
    return result;
  }

  /** Get an album by its ID
   * @param id - The ID of the album to retrieve
   * @returns {Promise<Album>} The album matching the given ID
   */
  async getAlbum(id: string): Promise<Album> {
    const cacheKey = `albums:detail:${id}`;
    const cached = await this.cacheManager.get<Album>(cacheKey);
    if (cached) return cached;

    const album = await this.db.album.findUnique({
      where: { id },
      include: {
        songs: true,
      },
    });
    if (!album) throw new NotFoundException('Album not found');
    if (album.cover)
      album.cover = await this.presignService.getImageUrl(
        'covers',
        album.cover,
      );

    await this.cacheManager.set(cacheKey, album, 60_000);
    return album;
  }

  /**
   * Update the cover image of an album
   * @param file - The new cover image file
   * @param id - The ID of the album to update
   * @param userId - The ID of the user updating the album
   * @returns {Promise<MessageResponseDto>} A message indicating the update was successful
   */
  async updateAlbumCover(
    file: Express.Multer.File,
    id: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime))
      throw new UnprocessableEntityException(
        'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
      );
    const album = await this.db.album.findUnique({ where: { id, userId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.cover)
      await this.s3.deleteObject({ Bucket: 'covers', Key: album.cover }); // remove previous image
    const fileKey = `${id}.${type.ext}`;
    await this.uploadService.uploadFile(
      file.buffer,
      fileKey,
      type.mime,
      'covers',
    );
    await this.db.album.update({
      where: { id },
      data: { cover: fileKey },
    });
    await this.cacheManager.del(`albums:detail:${id}`);
    return { message: 'Album cover updated successfully' };
  }

  /** Create a new album
   * @param data - The data for the new album
   * @param file - The file to upload as the album cover
   * @param id - The ID of the user creating the album
   * @returns {Promise<MessageResponseDto>} The newly created album
   */
  async createAlbum(
    data: CreateAlbumDto,
    file: Express.Multer.File,
    id: string,
  ): Promise<MessageResponseDto> {
    const type = await fileTypeFromBuffer(file.buffer);
    if (
      !type ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)
    ) {
      throw new UnprocessableEntityException(
        'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
      );
    }

    const album = await this.db.album.create({
      data: {
        title: data.title,
        releaseDate: new Date(data.releaseDate).toISOString(),
        cover: '', // change name after upload
        userId: id,
      },
    });
    const fileKey = `${album.id}.${type.ext}`;
    await this.uploadService.uploadFile(
      file.buffer,
      fileKey,
      type.mime,
      'covers',
    );
    await this.db.album.update({
      where: { id: album.id },
      data: { cover: fileKey },
    });
    return { message: 'Album created successfully' };
  }

  /** Edit an album by its ID
   * @param id - The ID of the album to edit
   * @param body - The updated data for the album
   * @param userId - The ID of the user editing the album
   * @returns {Promise<MessageResponseDto>} A message indicating the album was updated successfully
   */
  async editAlbum(
    id: string,
    body: EditAlbumDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    const { title, releaseDate } = body;
    const album = await this.db.album.findUnique({
      where: { id, userId },
    });
    if (!album) throw new NotFoundException('Album not found');
    await this.db.album.update({
      where: { id },
      data: { title, releaseDate },
    });
    await this.cacheManager.del(`albums:detail:${id}`);
    return { message: 'Album updated successfully' };
  }

  /**
   * Get all liked albums for a user
   * @param userId The user ID
   * @param query The pagination query
   * @returns {Promise<{ albums: Album[]; count: number }>}
   */
  async getLikedAlbums(
    userId: string,
    query: PaginationDto,
  ): Promise<{ albums: Album[]; count: number }> {
    const limit = Number(query.limit) || 10;
    const offset = Number(query.offset) || 0;

    const [albums, count] = await Promise.all([
      this.db.album.findMany({
        where: { likedBy: { some: { userId } } },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.album.count({
        where: { likedBy: { some: { userId } } },
      }),
    ]);

    return { albums, count };
  }

  /**
   * Like an album
   * @param albumId - The Id Of the album to like
   * @param userId - The Id of the user liking the album
   * @returns {Promise<MessageResponseDto>} A message indicating the album was liked successfully
   */
  async likeAlbum(
    albumId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    await this.getAlbum(albumId);
    await this.db.likedAlbum.upsert({
      where: {
        userId_albumId: {
          albumId,
          userId,
        },
      },
      update: {},
      create: {
        albumId,
        userId,
      },
    });

    return { message: 'Album liked successfully' };
  }

  /**
   * Unlike an album
   * @param albumId - The Id Of the album to unlike
   * @param userId - The Id of the user unliking the album
   * @returns {Promise<MessageResponseDto>} A message indicating the album was unliked successfully
   */
  async unlikeAlbum(
    albumId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    await this.getAlbum(albumId);
    await this.db.likedAlbum.deleteMany({
      where: {
        albumId,
        userId,
      },
    });

    return { message: 'Album unliked successfully' };
  }

  /** Delete an album by its ID
   * @param id - The ID of the album to delete
   * @param userId - The ID of the user deleting the album
   * @returns {Promise<MessageResponseDto>} A message indicating the album was deleted successfully
   */
  async deleteAlbum(id: string, userId: string): Promise<MessageResponseDto> {
    const album = await this.db.album.findUnique({
      where: { id, userId },
    });
    if (!album) throw new NotFoundException('Album not found');
    const songs = await this.db.song.findMany({
      where: { albumId: album.id },
    });
    await Promise.all(
      songs.map((song) => this.songsService.delete(song.id, userId)),
    );
    await this.s3.deleteObject({
      Bucket: 'covers',
      Key: album.cover,
    });
    await this.db.album.delete({ where: { id } });

    const cacheKey = `albums:detail:${id}`;
    await this.cacheManager.del(cacheKey);

    return { message: 'Album deleted successfully' };
  }
}

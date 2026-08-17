import { InjectQueue } from '@nestjs/bullmq';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AccessJwtPayload, AudioQuality } from '@repo/types';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { fileTypeFromFile } from 'file-type';
import { copyFile, unlink } from 'fs/promises';
import type { S3 } from 'nestjs-s3';
import { InjectS3 } from 'nestjs-s3';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

import { AUDIO_QUALITIES } from '../common/consts';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { Song } from '../generated/prisma/client';
import { PresignService } from '../upload/presign.service';
import { UploadService } from '../upload/upload.service';
import { EditSongDto } from './dto/edit.dto';
import { UploadSongDto } from './dto/upload.dto';
@Injectable()
export class SongsService {
  constructor(
    private readonly db: PrismaService,
    private readonly uploadService: UploadService,
    private readonly presignService: PresignService,
    @InjectQueue('audio') private readonly audioQueue: Queue,
    @InjectS3() private readonly s3: S3,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async validatePlayable(id: string): Promise<Song> {
    const song = await this.db.song.findUnique({
      where: { id, album: { user: { deletedAt: null } } },
    });
    if (!song) throw new NotFoundException('Song was not found');
    return song;
  }

  async getPlayUrl(
    id: string,
    quality: AudioQuality,
  ): Promise<{ url: string; expiresIn: number }> {
    const song = await this.validatePlayable(id);
    const url = await this.presignService.getSongPlayUrl(song.id, quality);
    return { url, expiresIn: 300 };
  }

  /**
   * Play a song from the S3 bucket
   * @param id The song ID
   * @param range The range of bytes to stream
   * @param res The response object
   * @param quality The audio quality
   * @returns {Promise<StreamableFile>}
   */
  async play(
    id: string,
    range: string,
    res: Response,
    quality: AudioQuality,
  ): Promise<StreamableFile> {
    const song = await this.validatePlayable(id);
    if (!range) {
      // Return the entire file stream
      const { Body, ContentType, ContentLength } = await this.s3.getObject({
        Bucket: 'songs',
        Key:
          quality && quality !== 'lossless'
            ? `${song.id}-${quality}.m4a`
            : song.id,
      });
      res.status(HttpStatus.OK);
      res.set({
        'Content-Length': ContentLength,
        'Content-Type': ContentType,
      });
      return new StreamableFile(Body as Readable);
    }

    const metadata = await this.s3.headObject({
      Bucket: 'songs',
      Key: quality ? `${song.id}-${quality}.m4a` : song.id,
    });
    const fileSize = metadata.ContentLength as number;
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (
      Number.isNaN(start) ||
      start < 0 ||
      start > fileSize - 1 ||
      end < start
    ) {
      res.set('Content-Range', `bytes */${fileSize}`);
      throw new HttpException(
        'Requested range not satisfiable',
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, // 416
      );
    }
    const chunkSize = end - start + 1;

    const { Body, ContentType } = await this.s3.getObject({
      Bucket: 'songs',
      Key: quality ? `${song.id}-${quality}.m4a` : song.id,
      Range: `bytes=${start}-${end}`,
    });

    res.status(HttpStatus.PARTIAL_CONTENT);
    res.set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': ContentType,
    });

    return new StreamableFile(Body as Readable);
  }

  /**
   * Upload a song to the S3 bucket
   * @param file The file to upload
   * @param user The user uploading the song
   * @param body The song metadata
   * @returns {Promise<MessageResponseDto>}
   */
  async upload(
    file: Express.Multer.File,
    user: AccessJwtPayload,
    body: UploadSongDto,
  ): Promise<MessageResponseDto & { id: string }> {
    let conversionSourcePath: string | undefined;
    let conversionJobQueued = false;

    try {
      const type = await fileTypeFromFile(file.path);
      if (
        !type ||
        !['audio/flac', 'audio/wav', 'audio/x-wav'].includes(type.mime)
      )
        throw new UnprocessableEntityException('Invalid file type');
      const album = await this.db.album.findUnique({
        where: { id: body.albumId, userId: user.sub }, // only current user albums
      });
      if (!album) {
        throw new NotFoundException({
          message: 'No Album exists with this ID',
          errorCode: 'ALBUM_404',
        });
      }
      const existsingSong = await this.db.song.findFirst({
        where: { title: body.title, albumId: body.albumId },
      });
      if (existsingSong)
        throw new ConflictException('Song already exists in the Album');

      const song = await this.db.song.create({
        data: {
          title: body.title,
          album: { connect: { id: body.albumId } },
          genre: { connect: { id: body.genreId } },
          duration: body.duration,
        },
      });

      conversionSourcePath = join(tmpdir(), `${Date.now()}-${song.id}`);
      await copyFile(file.path, conversionSourcePath);
      await this.audioQueue.add('convert', {
        path: conversionSourcePath,
        name: song.id,
      });
      conversionJobQueued = true;

      await this.uploadService.uploadFile(
        file.path,
        song.id,
        type.mime,
        'songs',
        user.sub,
      );

      await this.cacheManager.del(`albums:detail:${body.albumId}`);

      return { id: song.id, message: 'Song uploaded successfully' };
    } finally {
      await unlink(file.path).catch(() => {});
      if (conversionSourcePath && !conversionJobQueued) {
        await unlink(conversionSourcePath).catch(() => {});
      }
    }
  }

  /**
   * Get all liked songs for a user
   * @param userId The user ID
   * @param query The pagination query
   * @returns {Promise<{ songs: Song[]; count: number }>}
   */
  async getLiked(
    userId: string,
    query: PaginationDto,
  ): Promise<{ songs: Song[]; count: number }> {
    const limit = Number(query.limit) || 10;
    const offset = Number(query.offset) || 0;

    const [songs, count] = await Promise.all([
      this.db.song.findMany({
        where: { likedBy: { some: { userId } } },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.song.count({
        where: { likedBy: { some: { userId } } },
      }),
    ]);

    return { songs, count };
  }

  /**
   * Edit a song
   * @param id The song ID
   * @param body The song metadata
   * @param user The user editing the song
   * @returns {Promise<MessageResponseDto>}
   */
  async edit(
    id: string,
    body: EditSongDto,
    user: AccessJwtPayload,
  ): Promise<MessageResponseDto> {
    // find user of this song album, that has a user id of the current user logged in
    const song = await this.db.song.findUnique({
      where: { id, album: { userId: user.sub } },
    });
    if (!song) throw new NotFoundException('Song was not found');
    await this.db.song.update({
      where: { id },
      data: {
        title: body.title,
        genre: { connect: { id: body.genreId } },
      },
    });

    await this.cacheManager.del(`albums:detail:${song.albumId}`);

    return { message: 'Song updated successfully' };
  }

  /**
   * Like a song
   * @param id The song ID
   * @param userId The user ID
   * @returns {Promise<void>}
   */
  async like(id: string, userId: string): Promise<MessageResponseDto> {
    const song = await this.db.song.findUnique({
      where: { id },
    });
    if (!song) throw new NotFoundException('Song was not found');
    await this.db.likedSong.upsert({
      where: {
        userId_songId: {
          songId: id,
          userId,
        },
      },
      update: {},
      create: {
        songId: id,
        userId,
      },
    });

    return { message: 'Song was successfully added to liked' };
  }

  /**
   * Unlike a song
   * @param id The song ID
   * @param userId The user ID
   * @returns {Promise<void>}
   */
  async unlike(id: string, userId: string): Promise<MessageResponseDto> {
    const song = await this.db.song.findUnique({
      where: { id },
    });
    if (!song) throw new NotFoundException('Song was not found');
    await this.db.likedSong.deleteMany({
      where: {
        songId: id,
        userId,
      },
    });

    return { message: 'Song was removed from liked' };
  }

  /**
   * Delete a song
   * @param id The song ID
   * @param userId The user ID
   * @returns {Promise<void>}
   */
  async delete(id: string, userId: string): Promise<MessageResponseDto> {
    // same logic applies here
    const song = await this.db.song.findUnique({
      where: { id, album: { userId } },
    });
    if (!song) throw new NotFoundException('Song was not found');
    await this.db.song.delete({ where: { id } });
    for (const quality of AUDIO_QUALITIES) {
      await this.s3.deleteObject({
        Bucket: 'songs',
        Key: song.id + `-${quality.name}.m4a`,
      });
    }
    await this.s3.deleteObject({ Bucket: 'songs', Key: song.id });

    await this.cacheManager.del(`albums:detail:${song.albumId}`);

    return { message: 'Song deleted successfully' };
  }
}

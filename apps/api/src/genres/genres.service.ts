import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateGenreDto } from './dto/create-genre.dto';
import { EditGenreDto } from './dto/edit-genre.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Genre } from '../generated/prisma/client';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class GenresService {
  constructor(
    private readonly db: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get a genre by id
   * @param id The genre id
   * @returns {Promise<Genre>}
   */
  async getGenre(id: string): Promise<Genre> {
    const cacheKey = `genres:detail:${id}`;
    const cached = await this.cacheManager.get<Genre>(cacheKey);
    if (cached) return cached;

    const genre = await this.db.genre.findUnique({
      where: { id },
    });
    if (!genre) throw new NotFoundException('Genre not found');

    await this.cacheManager.set(cacheKey, genre, 60_000);
    return genre;
  }

  /**
   * Get genres by name with a fuzzy search
   * @param name The genre name
   * @param query The pagination query
   * @returns {Promise<Genre[]>}
   */
  async getGenres(
    query: PaginationDto,
  ): Promise<{ genres: Genre[]; count: number }> {
    const limit = Number(query.limit) || 10;
    const offset = Number(query.offset) || 0;

    const [genres, count] = await Promise.all([
      this.db.genre.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.genre.count(),
    ]);

    return { genres, count };
  }

  /**
   * Create a genre
   * @param data The genre data
   * @returns {Promise<MessageResponseDto>}
   */
  async createGenre(data: CreateGenreDto): Promise<MessageResponseDto> {
    const { name, description } = data;
    const existingGenre = await this.db.genre.findUnique({
      where: { name },
    });
    if (existingGenre)
      throw new ConflictException('Genre with this name is already exists');
    await this.db.genre.create({
      data: { name, description },
    });

    return { message: 'Genre was successfully created' };
  }

  /**
   * Edit a genre
   * @param data The genre data
   * @param id The genre id
   * @returns {Promise<MessageResponseDto>}
   */
  async editGenre(data: EditGenreDto, id: string): Promise<MessageResponseDto> {
    const { name, description } = data;
    await this.getGenre(id);

    const existingGenre = await this.db.genre.findUnique({
      where: { name },
    });
    if (existingGenre && existingGenre.id !== id)
      throw new ConflictException('Genre with this name is already exists');
    await this.db.genre.update({
      where: { id },
      data: { name, description },
    });
    await this.cacheManager.del(`genres:detail:${id}`);
    return { message: 'Genre was edited successfully' };
  }
}

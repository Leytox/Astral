import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SearchResponseDto } from './dto/search.dto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PresignService } from '../upload/presign.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly db: PrismaService,
    private readonly presignService: PresignService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Searches for albums, songs, and genres based on the given title
   * @param title The search query string
   * @returns {Promise<SearchResponseDto[]>}
   */
  async search(title: string): Promise<SearchResponseDto[]> {
    const cacheKey = `search:list:${title}`;
    const cachedResults =
      await this.cacheManager.get<SearchResponseDto[]>(cacheKey);
    if (cachedResults) return cachedResults;

    const searchResults = await this.db.$queryRaw<[SearchResponseDto]>`
      SELECT * FROM (
        SELECT 'album' AS type, id, title AS name, cover AS "imageUrl"
        FROM "Album"
        WHERE similarity(title, ${title}::text) > 0.2
        UNION ALL
        SELECT 'song' AS type, s.id, s.title AS name, a.cover AS "imageUrl"
        FROM "Song" s JOIN "Album" a ON s."albumId" = a.id
        WHERE similarity(s.title, ${title}::text) > 0.2
        UNION ALL
        SELECT 'genre' AS type, id, name, NULL AS "imageUrl"
        FROM "Genre"
        WHERE similarity(name, ${title}::text) > 0.2
        UNION ALL
        SELECT 'user' AS type, id, username AS name, avatar AS "imageUrl"
        FROM "User"
        WHERE similarity(username, ${title}::text) > 0.2
        UNION ALL
        SELECT 'playlist' AS type, id, name, NULL AS "imageUrl"
        FROM "Playlist"
        WHERE similarity(name, ${title}::text) > 0.2 AND "isPublic" = true
      ) AS results
      ORDER BY similarity(name, ${title}::text) DESC
      LIMIT 5
    `;
    for (const result of searchResults) {
      if (
        (result.type === 'album' || result.type === 'song') &&
        result.imageUrl
      ) {
        result.imageUrl = await this.presignService.getImageUrl(
          'covers',
          result.imageUrl,
        );
      } else if (result.type === 'user' && result.imageUrl) {
        result.imageUrl = await this.presignService.getImageUrl(
          'avatars',
          result.imageUrl,
        );
      }
    }
    await this.cacheManager.set(cacheKey, searchResults, 30_000);
    return searchResults;
  }
}

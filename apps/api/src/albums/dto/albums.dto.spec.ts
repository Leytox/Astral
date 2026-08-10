import { AlbumDto } from './album.dto';
import { CreateAlbumDto } from './create-album.dto';
import { EditAlbumDto } from './edit-album.dto';

const validSong = {
  id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
  title: 'Title',
  albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
  duration: 168,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

const validAlbum = {
  id: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  title: 'Alpha',
  cover: 'https://cdn.example.com/covers/album-1.jpg',
  userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
  releaseDate: '2011-03-04',
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

describe('AlbumDto', () => {
  it('accepts a valid album payload with songs', () => {
    const result = AlbumDto.schema.safeParse({
      ...validAlbum,
      songs: [validSong],
    });

    expect(result.success).toBe(true);
  });

  it('accepts an album without songs', () => {
    expect(AlbumDto.schema.safeParse(validAlbum).success).toBe(true);
  });

  it('rejects a cover that is not a valid URL', () => {
    const result = AlbumDto.schema.safeParse({
      ...validAlbum,
      cover: 'not-a-url',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['cover']);
    }
  });

  it('rejects an invalid release date', () => {
    const result = AlbumDto.schema.safeParse({
      ...validAlbum,
      releaseDate: 'soon',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['releaseDate']);
    }
  });
});

describe('CreateAlbumDto', () => {
  it('accepts a title and release date', () => {
    const result = CreateAlbumDto.schema.safeParse({
      title: 'Alpha',
      releaseDate: '2011-03-04',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = CreateAlbumDto.schema.safeParse({
      title: '',
      releaseDate: '2011-03-04',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['title']);
    }
  });

  it('rejects a title longer than 64 characters', () => {
    const result = CreateAlbumDto.schema.safeParse({
      title: 'A'.repeat(65),
      releaseDate: '2011-03-04',
    });

    expect(result.success).toBe(false);
  });
});

describe('EditAlbumDto', () => {
  it('accepts a partial payload', () => {
    const result = EditAlbumDto.schema.safeParse({ title: 'Beta' });

    expect(result.success).toBe(true);
  });

  it('accepts an empty payload', () => {
    expect(EditAlbumDto.schema.safeParse({}).success).toBe(true);
  });

  it('still validates the release date when provided', () => {
    expect(EditAlbumDto.schema.safeParse({ releaseDate: 'nope' }).success).toBe(
      false,
    );
  });
});

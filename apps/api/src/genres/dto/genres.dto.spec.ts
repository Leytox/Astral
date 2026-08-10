import { GenreDto } from './genre.dto';
import { CreateGenreDto } from './create-genre.dto';
import { EditGenreDto } from './edit-genre.dto';

const validSong = {
  id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
  title: 'Title',
  albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
  duration: 168,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

const validGenre = {
  id: '53ad4a23-c032-4196-b32f-d5282ab59915',
  name: 'Rock',
  description: 'Loud guitars and heavy drums',
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

describe('GenreDto', () => {
  it('accepts a valid genre payload', () => {
    expect(GenreDto.schema.safeParse(validGenre).success).toBe(true);
  });

  it('accepts an optional description and song list', () => {
    const { description: _omitted, ...withoutDescription } = validGenre;

    expect(GenreDto.schema.safeParse(withoutDescription).success).toBe(true);
    expect(
      GenreDto.schema.safeParse({ ...validGenre, songs: [validSong] }).success,
    ).toBe(true);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = GenreDto.schema.safeParse({ ...validGenre, name: 'R' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name']);
    }
  });

  it('rejects a description shorter than 12 characters', () => {
    const result = GenreDto.schema.safeParse({
      ...validGenre,
      description: 'Too short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['description']);
    }
  });
});

describe('CreateGenreDto', () => {
  it('accepts a name with an optional description', () => {
    expect(
      CreateGenreDto.schema.safeParse({
        name: 'Rock',
        description: 'Loud guitars',
      }).success,
    ).toBe(true);
    expect(CreateGenreDto.schema.safeParse({ name: 'Rock' }).success).toBe(
      true,
    );
  });

  it('rejects a name shorter than 2 characters', () => {
    expect(CreateGenreDto.schema.safeParse({ name: 'R' }).success).toBe(false);
  });
});

describe('EditGenreDto', () => {
  it('accepts a partial payload', () => {
    expect(
      EditGenreDto.schema.safeParse({ description: 'Updated blurb' }).success,
    ).toBe(true);
    expect(EditGenreDto.schema.safeParse({}).success).toBe(true);
  });

  it('still validates fields when provided', () => {
    expect(EditGenreDto.schema.safeParse({ name: 'X' }).success).toBe(false);
  });
});

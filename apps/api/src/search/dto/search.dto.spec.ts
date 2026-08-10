import { SearchResponseDto } from './search.dto';

describe('SearchResponseDto', () => {
  const validResult = {
    type: 'album',
    id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
    name: 'Alpha',
    imageUrl: 'https://cdn.example.com/covers/album-1.jpg',
  };

  it('accepts every result type', () => {
    for (const type of ['song', 'album', 'playlist', 'user', 'genre']) {
      expect(
        SearchResponseDto.schema.safeParse({ ...validResult, type }).success,
      ).toBe(true);
    }
  });

  it('rejects an unknown result type', () => {
    const result = SearchResponseDto.schema.safeParse({
      ...validResult,
      type: 'artist',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['type']);
    }
  });

  it('rejects an image url that is not a valid URL', () => {
    const result = SearchResponseDto.schema.safeParse({
      ...validResult,
      imageUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['imageUrl']);
    }
  });

  it('rejects an id that is not a UUID v4', () => {
    expect(
      SearchResponseDto.schema.safeParse({ ...validResult, id: 'x' }).success,
    ).toBe(false);
  });
});

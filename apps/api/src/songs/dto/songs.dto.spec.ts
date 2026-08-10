import { SongDto } from './song.dto';
import { UploadSongDto } from './upload.dto';
import { EditSongDto } from './edit.dto';

const validSong = {
  id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
  title: 'Title',
  albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
  duration: 168,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

describe('SongDto', () => {
  it('accepts a valid song payload and coerces the duration', () => {
    const result = SongDto.schema.safeParse({
      ...validSong,
      duration: '168',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(168);
    }
  });

  it('rejects an id that is not a UUID v4', () => {
    const result = SongDto.schema.safeParse({ ...validSong, id: 'not-a-uuid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['id']);
    }
  });

  it('rejects an invalid date', () => {
    const result = SongDto.schema.safeParse({
      ...validSong,
      createdAt: 'yesterday',
    });

    expect(result.success).toBe(false);
  });
});

describe('UploadSongDto', () => {
  const validUpload = {
    title: 'New Track',
    albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
    genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
    duration: 168,
  };

  it('accepts a valid upload payload and coerces the duration', () => {
    const result = UploadSongDto.schema.safeParse({
      ...validUpload,
      duration: '168',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(168);
    }
  });

  it('rejects a duration above 1800 seconds', () => {
    const result = UploadSongDto.schema.safeParse({
      ...validUpload,
      duration: 1801,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['duration']);
    }
  });

  it('rejects a non-uuid album id', () => {
    const result = UploadSongDto.schema.safeParse({
      ...validUpload,
      albumId: 'x',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['albumId']);
    }
  });

  it('rejects a payload without a title', () => {
    const { title: _omitted, ...withoutTitle } = validUpload;

    expect(UploadSongDto.schema.safeParse(withoutTitle).success).toBe(false);
  });
});

describe('EditSongDto', () => {
  const validEdit = {
    title: 'Renamed Track',
    genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
    duration: 180,
  };

  it('accepts an edit payload with optional multiple author ids', () => {
    const result = EditSongDto.schema.safeParse({
      ...validEdit,
      userId: ['8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b'],
    });

    expect(result.success).toBe(true);
  });

  it('does not expose the album id (omitted from the schema)', () => {
    const result = EditSongDto.schema.safeParse({
      ...validEdit,
      albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('albumId');
    }
  });

  it('still enforces the inherited duration bound', () => {
    const result = EditSongDto.schema.safeParse({
      ...validEdit,
      duration: 5000,
    });

    expect(result.success).toBe(false);
  });
});

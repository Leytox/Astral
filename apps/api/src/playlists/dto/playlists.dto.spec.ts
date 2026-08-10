import { PlaylistDto } from './playlist.dto';
import { CreatePlaylistDto } from './create-playlist.dto';
import { EditPlaylistDto } from './edit-playlist.dto';

const validSong = {
  id: '726c50eb-f4d7-47c1-b9d9-2794a2237b01',
  title: 'Title',
  albumId: '8ed07a4b-1876-4b13-afc1-6b9c54fa5d3b',
  genreId: '53ad4a23-c032-4196-b32f-d5282ab59915',
  duration: 168,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

const validPlaylist = {
  id: '93e8f66e-61a4-46f2-b589-d8eb7bc73575',
  name: 'Road Trip',
  isPublic: true,
  userId: 'a63687ad-614b-4f41-97f5-d00140e3c882',
  songs: [validSong],
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

describe('PlaylistDto', () => {
  it('accepts a valid playlist payload', () => {
    expect(PlaylistDto.schema.safeParse(validPlaylist).success).toBe(true);
  });

  it('rejects a non-boolean isPublic flag', () => {
    const result = PlaylistDto.schema.safeParse({
      ...validPlaylist,
      isPublic: 'yes',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['isPublic']);
    }
  });

  it('rejects a missing song list', () => {
    const { songs: _omitted, ...withoutSongs } = validPlaylist;

    expect(PlaylistDto.schema.safeParse(withoutSongs).success).toBe(false);
  });
});

describe('CreatePlaylistDto', () => {
  it('accepts a name and visibility flag', () => {
    expect(
      CreatePlaylistDto.schema.safeParse({ name: 'Road Trip', isPublic: true })
        .success,
    ).toBe(true);
  });

  it('rejects a payload without a name', () => {
    expect(CreatePlaylistDto.schema.safeParse({ isPublic: true }).success).toBe(
      false,
    );
  });
});

describe('EditPlaylistDto', () => {
  it('accepts a partial payload', () => {
    expect(EditPlaylistDto.schema.safeParse({ isPublic: false }).success).toBe(
      true,
    );
    expect(EditPlaylistDto.schema.safeParse({}).success).toBe(true);
  });
});

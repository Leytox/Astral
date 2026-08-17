import { Test } from '@nestjs/testing';

import { GenresController } from './genres.controller';
import { GenresService } from './genres.service';

// genres.controller imports `Roles`/`RolesGuard` via the `src/...` path alias,
// which is only defined in tsconfig.json (baseUrl), not in tsconfig.spec.json.
// Jest cannot resolve those specifiers, so register them as virtual mocks; the
// decorators are never exercised by the delegation tests below.
jest.mock(
  'src/common/decorators/roles.decorator',
  () => ({
    Roles:
      (..._roles: unknown[]) =>
      () =>
        undefined,
  }),
  { virtual: true },
);

jest.mock(
  'src/common/guards/roles.guard',
  () => ({
    RolesGuard: class RolesGuard {},
  }),
  { virtual: true },
);

describe('GenresController', () => {
  let controller: GenresController;
  const mockGenresService = {
    getGenre: jest.fn(),
    getGenres: jest.fn(),
    createGenre: jest.fn(),
    editGenre: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GenresController],
      providers: [{ provide: GenresService, useValue: mockGenresService }],
    }).compile();

    controller = moduleRef.get(GenresController);
  });

  it('delegates getGenre', async () => {
    mockGenresService.getGenre.mockResolvedValue({ id: 'genre-1' });

    const result = await controller.getGenre('genre-1');

    expect(mockGenresService.getGenre).toHaveBeenCalledWith('genre-1');
    expect(result).toEqual({ id: 'genre-1' });
  });

  it('delegates getGenres', async () => {
    const query = { limit: '10', offset: '0' };
    mockGenresService.getGenres.mockResolvedValue({ genres: [], count: 0 });

    const result = await controller.getGenres(query as any);

    expect(mockGenresService.getGenres).toHaveBeenCalledWith(query);
    expect(result).toEqual({ genres: [], count: 0 });
  });

  it('delegates createGenre', async () => {
    const dto = { name: 'Rock', description: 'Loud guitars' };
    mockGenresService.createGenre.mockResolvedValue({
      message: 'Genre was successfully created',
    });

    const result = await controller.createGenre(dto);

    expect(mockGenresService.createGenre).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'Genre was successfully created' });
  });

  it('delegates editGenre', async () => {
    const dto = { name: 'Hard Rock', description: 'Heavier' };
    mockGenresService.editGenre.mockResolvedValue({
      message: 'Genre was edited successfully',
    });

    const result = await controller.editGenre(dto, 'genre-1');

    expect(mockGenresService.editGenre).toHaveBeenCalledWith(dto, 'genre-1');
    expect(result).toEqual({ message: 'Genre was edited successfully' });
  });
});

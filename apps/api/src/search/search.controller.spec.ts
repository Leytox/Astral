import { Test } from '@nestjs/testing';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  const mockSearchService = {
    search: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSearchService }],
    }).compile();

    controller = moduleRef.get(SearchController);
  });

  it('delegates search', async () => {
    const results = [{ type: 'genre', id: 'genre-1', name: 'Rock' }];
    mockSearchService.search.mockResolvedValue(results);

    const result = await controller.search('Rock');

    expect(mockSearchService.search).toHaveBeenCalledWith('Rock');
    expect(result).toBe(results);
  });
});

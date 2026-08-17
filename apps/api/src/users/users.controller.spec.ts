import { Test } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// users.controller loads users.service transitively, which imports the
// ESM-only `file-type` package; keep it mocked.
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

describe('UsersController', () => {
  let controller: UsersController;
  const mockUsersService = {
    getProfile: jest.fn(),
    getUserById: jest.fn(),
    uploadProfilePicture: jest.fn(),
    editProfile: jest.fn(),
    deleteProfile: jest.fn(),
  };

  const user = { sub: 'user-1' };
  const file = { buffer: Buffer.from('avatar-data') } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  it('delegates getProfile', async () => {
    mockUsersService.getProfile.mockResolvedValue({ id: 'user-1' });

    const result = await controller.getProfile(user as any);

    expect(mockUsersService.getProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('delegates getUser', async () => {
    mockUsersService.getUserById.mockResolvedValue({ id: 'user-1' });

    const result = await controller.getUser('user-1');

    expect(mockUsersService.getUserById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('delegates uploadProfilePicture', async () => {
    mockUsersService.uploadProfilePicture.mockResolvedValue({
      message: 'Profile picture uploaded successfully',
    });

    const result = await controller.uploadProfilePicture(user as any, file);

    expect(mockUsersService.uploadProfilePicture).toHaveBeenCalledWith(
      'user-1',
      file,
    );
    expect(result).toEqual({
      message: 'Profile picture uploaded successfully',
    });
  });

  it('delegates editProfile', async () => {
    const dto = { firstName: 'Jane' };
    mockUsersService.editProfile.mockResolvedValue({
      message: 'Profile updated successfully',
    });

    const result = await controller.editProfile(user as any, dto as any);

    expect(mockUsersService.editProfile).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ message: 'Profile updated successfully' });
  });

  it('delegates deleteProfile', async () => {
    mockUsersService.deleteProfile.mockResolvedValue({
      message: 'Profile deleted successfully',
    });

    const result = await controller.deleteProfile(user as any);

    expect(mockUsersService.deleteProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ message: 'Profile deleted successfully' });
  });
});

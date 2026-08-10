import { EditUserDto } from './edit-user.dto';
import { GetProfileDto } from './get-profile.dto';
import { GetUserDto } from './get-user.dto';

const validProfile = {
  id: 'a63687ad-614b-4f41-97f5-d00140e3c882',
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
  email: 'john@example.com',
  verified: true,
};

describe('EditUserDto', () => {
  it('accepts the editable profile fields', () => {
    const result = EditUserDto.schema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an email (not part of the editable subset)', () => {
    // Unknown keys are stripped rather than rejected; the email must not leak
    // into the parsed result.
    const result = EditUserDto.schema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      email: 'hacker@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('email');
    }
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = EditUserDto.schema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      username: 'ab',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['username']);
    }
  });
});

describe('GetProfileDto', () => {
  it('accepts a valid profile payload', () => {
    expect(GetProfileDto.schema.safeParse(validProfile).success).toBe(true);
  });

  it('rejects a non-boolean verified flag', () => {
    const result = GetProfileDto.schema.safeParse({
      ...validProfile,
      verified: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['verified']);
    }
  });

  it('rejects an invalid email', () => {
    const result = GetProfileDto.schema.safeParse({
      ...validProfile,
      email: 'nope',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
    }
  });
});

describe('GetUserDto', () => {
  it('accepts a valid user payload without email or verification fields', () => {
    const {
      email: _omittedEmail,
      verified: _omittedVerified,
      ...user
    } = validProfile;

    const result = GetUserDto.schema.safeParse(user);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('email');
      expect(result.data).not.toHaveProperty('verified');
    }
  });
});

import { ForgotPasswordDto } from './forgot-password.dto';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { SessionDto } from './session.dto';
import { VerificationCodeDto } from './verification-code.dto';

const validRegistration = {
  email: 'john@example.com',
  password: 'Password123!',
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
};

describe('RegisterDto', () => {
  const parse = (input: unknown) => RegisterDto.schema.safeParse(input);

  it('accepts a valid registration payload', () => {
    const result = parse(validRegistration);

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = parse({ ...validRegistration, email: 'not-an-email' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
    }
  });

  it.each([
    ['too short', 'Ab1!', 'Password must be at least 8 characters long'],
    [
      'too long',
      'A'.repeat(40) + 'b1!',
      'Password cannot exceed 32 characters',
    ],
    [
      'no lowercase',
      'PASSWORD123!',
      'Password must contain at least one lowercase letter',
    ],
    [
      'no uppercase',
      'password123!',
      'Password must contain at least one uppercase letter',
    ],
    ['no number', 'Password!', 'Password must contain at least one number'],
    [
      'no special character',
      'Password123',
      'Password must contain at least one special character',
    ],
  ])('rejects a password that is %s', (_label, password, message) => {
    const result = parse({ ...validRegistration, password });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(message);
    }
  });

  it('rejects a first name shorter than 2 characters', () => {
    const result = parse({ ...validRegistration, firstName: 'J' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['firstName']);
    }
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = parse({ ...validRegistration, username: 'ab' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['username']);
    }
  });

  it('creates a validated instance through the DTO class', () => {
    const dto = RegisterDto.create(validRegistration);

    expect(dto.username).toBe('johndoe');
  });
});

describe('LoginDto', () => {
  it('accepts valid credentials', () => {
    const result = LoginDto.schema.safeParse({
      username: 'johndoe',
      password: 'Password123!',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a short password', () => {
    const result = LoginDto.schema.safeParse({
      username: 'johndoe',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a short username', () => {
    const result = LoginDto.schema.safeParse({
      username: 'ab',
      password: 'Password123!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['username']);
    }
  });
});

describe('VerificationCodeDto', () => {
  it('accepts a valid email', () => {
    expect(
      VerificationCodeDto.schema.safeParse({ email: 'john@example.com' })
        .success,
    ).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(
      VerificationCodeDto.schema.safeParse({ email: 'nope' }).success,
    ).toBe(false);
  });
});

describe('ForgotPasswordDto', () => {
  it('accepts a valid email', () => {
    expect(
      ForgotPasswordDto.schema.safeParse({ email: 'john@example.com' }).success,
    ).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(ForgotPasswordDto.schema.safeParse({ email: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('RefreshDto', () => {
  it('accepts an access token', () => {
    expect(RefreshDto.schema.safeParse({ access_token: 'token' }).success).toBe(
      true,
    );
  });

  it('rejects a payload without an access token', () => {
    expect(RefreshDto.schema.safeParse({}).success).toBe(false);
  });
});

describe('ResetPasswordDto', () => {
  const parse = (input: unknown) => ResetPasswordDto.schema.safeParse(input);
  const valid = { token: 'reset-token', newPassword: 'NewPassword1!' };

  it('accepts a valid token and password', () => {
    expect(parse(valid).success).toBe(true);
  });

  it('rejects a weak new password', () => {
    const result = parse({ ...valid, newPassword: 'weak' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['newPassword']);
    }
  });

  it('rejects a payload without a token', () => {
    const result = parse({ newPassword: 'NewPassword1!' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['token']);
    }
  });
});

describe('SessionDto', () => {
  const validSession = {
    createdAt: '2026-08-01',
    jti: 'jti-1',
    ipAddress: '127.0.0.1',
    location: 'Kyiv, UA',
    userAgent: 'Mozilla/5.0',
    deviceName: 'MacBook',
    lastUsedAt: '2026-08-01',
  };

  it('accepts a valid session payload', () => {
    expect(SessionDto.schema.safeParse(validSession).success).toBe(true);
  });

  it('rejects an invalid ISO date', () => {
    const result = SessionDto.schema.safeParse({
      ...validSession,
      createdAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['createdAt']);
    }
  });

  it('rejects a payload without a jti', () => {
    const { jti: _omitted, ...withoutJti } = validSession;

    expect(SessionDto.schema.safeParse(withoutJti).success).toBe(false);
  });
});

import { PaginationDto } from './pagination.dto';
import { MessageResponseDto } from './message-response.dto';

describe('PaginationDto', () => {
  const parse = (input: unknown) => PaginationDto.schema.safeParse(input);

  it('applies the default offset and limit to an empty query', () => {
    const result = parse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ offset: 0, limit: 20 });
    }
  });

  it('coerces string query values into numbers', () => {
    const result = parse({ offset: '5', limit: '50' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ offset: 5, limit: 50 });
    }
  });

  it('rejects a limit above 100', () => {
    const result = parse({ limit: 101 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['limit']);
    }
  });

  it('rejects a zero or negative limit', () => {
    expect(parse({ limit: 0 }).success).toBe(false);
    expect(parse({ limit: -5 }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(parse({ offset: -1 }).success).toBe(false);
  });

  it('rejects a non-integer limit', () => {
    expect(parse({ limit: 1.5 }).success).toBe(false);
  });

  it('rejects a non-numeric value', () => {
    expect(parse({ limit: 'abc' }).success).toBe(false);
  });
});

describe('MessageResponseDto', () => {
  it('accepts a message string', () => {
    const result = MessageResponseDto.schema.safeParse({
      message: 'Account created successfully',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload without a message', () => {
    const result = MessageResponseDto.schema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('creates a validated instance through the DTO class', () => {
    const dto = MessageResponseDto.create({ message: 'ok' });

    expect(dto).toEqual({ message: 'ok' });
  });
});

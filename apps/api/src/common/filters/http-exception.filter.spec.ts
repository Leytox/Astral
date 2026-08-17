import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { GlobalHttpExceptionFilter } from './http-exception.filter';

describe('GlobalHttpExceptionFilter', () => {
  let filter: GlobalHttpExceptionFilter;

  const makeResponse = () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  const makeHost = (res: any): ArgumentsHost =>
    ({ switchToHttp: () => ({ getResponse: () => res }) }) as ArgumentsHost;

  const catchException = (exception: HttpException) => {
    const res = makeResponse();
    filter.catch(exception, makeHost(res));
    return res;
  };

  beforeEach(() => {
    filter = new GlobalHttpExceptionFilter();
  });

  it('formats a string response body', () => {
    const res = catchException(
      new HttpException('custom error', HttpStatus.I_AM_A_TEAPOT),
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 418,
      message: 'custom error',
      errorCode: undefined,
    });
  });

  it('uses the message string of an object body', () => {
    const res = catchException(
      new BadRequestException({ message: 'Invalid input' }),
    );

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid input',
      errorCode: undefined,
    });
  });

  it('passes through a message array', () => {
    const res = catchException(
      new BadRequestException({ message: ['a', 'b', 'c'] }),
    );

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: ['a', 'b', 'c'],
      errorCode: undefined,
    });
  });

  it('captures the errorCode from an object body', () => {
    const res = catchException(
      new BadRequestException({ message: 'x', errorCode: 'E' }),
    );

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'x',
      errorCode: 'E',
    });
  });

  it('falls back to exception.message when the body has no message', () => {
    const res = catchException(new BadRequestException({ errorCode: 'E' }));

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Bad Request Exception',
      errorCode: 'E',
    });
  });

  it('falls back to exception.message when the body is not a string or object', () => {
    const res = catchException(
      new HttpException(42 as any, HttpStatus.BAD_REQUEST),
    );

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Http Exception',
      errorCode: undefined,
    });
  });
});

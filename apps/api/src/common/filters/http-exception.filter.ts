import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

interface HttpExceptionResponseBody {
  message?: string | string[];
  errorCode?: string;
}

function isHttpExceptionResponseBody(
  value: unknown,
): value is HttpExceptionResponseBody {
  return typeof value === 'object' && value !== null;
}

@Catch(HttpException)
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    let message: string | string[] = exception.message;
    let errorCode: string | undefined;

    if (typeof body === 'string') {
      message = body;
    } else if (isHttpExceptionResponseBody(body)) {
      if (body.message !== undefined) {
        message = body.message;
      }
      errorCode = body.errorCode;
    }

    res.status(status).json({ statusCode: status, message, errorCode });
  }
}

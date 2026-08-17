import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestInfo } from '@repo/types';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';
export const GetRequestInfo = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestInfo => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    const parser = new UAParser(userAgent);
    const os = parser.getOS().name || '';
    const deviceType = parser.getDevice().type || 'desktop';
    const deviceVendor = parser.getDevice().vendor || '';
    const deviceModel = parser.getDevice().model || '';

    // Format a human-readable device name
    let device = `${os} ${deviceType}`;
    if (deviceVendor || deviceModel) {
      device = `${deviceVendor} ${deviceModel} (${os})`.trim();
    }

    return {
      ip: ip as string,
      userAgent,
      device,
    };
  },
);

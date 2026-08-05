import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt-optional') {
  handleRequest(err: any, user: any): any {
    if (err || !user) {
      return null;
    }
    return user;
  }
}

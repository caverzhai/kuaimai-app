import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export interface AuthUser {
  userId: string;
  phone: string;
  level: string;
  isInvited: boolean;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录');
    }

    const token = authHeader.slice(7);
    try {
      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString('utf-8'),
      );
      if (!decoded.userId) {
        throw new UnauthorizedException('Token无效');
      }
      request.user = {
        userId: decoded.userId,
        phone: decoded.phone,
        level: decoded.level,
        isInvited: decoded.isInvited,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token无效');
    }
  }
}

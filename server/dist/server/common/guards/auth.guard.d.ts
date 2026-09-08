import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export interface AuthUser {
    userId: string;
    phone: string;
    level: string;
    isInvited: boolean;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare class AuthGuard implements CanActivate {
    private readonly reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}

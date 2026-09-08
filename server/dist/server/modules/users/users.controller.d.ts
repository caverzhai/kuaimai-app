import type { Request } from 'express';
import { UsersService } from './users.service';
import type { SupplementInviterDTO, UpdateProfileDTO, UserInfo } from '@shared/api.interface';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: Request): Promise<UserInfo>;
    updateProfile(req: Request, dto: UpdateProfileDTO): Promise<UserInfo>;
    supplementInviter(req: Request, dto: SupplementInviterDTO): Promise<UserInfo>;
    getInviteCode(req: Request): Promise<{
        inviteCode: string;
    }>;
}

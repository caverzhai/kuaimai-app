import type { Request } from 'express';
import { UsersService } from './users.service';
import type { SupplementInviterDTO, UpdateProfileDTO, UserInfo } from '@shared/api.interface';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: Request): Promise<UserInfo>;
    getRelationTree(req: Request): Promise<{
        directInviter: {
            id: string;
            nickname: string;
            phone: string;
            level: string;
        } | null;
        directParent: {
            id: string;
            nickname: string;
            phone: string;
            level: string;
        } | null;
        directChildren: Array<{
            id: string;
            nickname: string;
            phone: string;
            level: string;
        }>;
        secondGenerationChildren: Array<{
            id: string;
            nickname: string;
            phone: string;
            level: string;
        }>;
        thirdGenerationChildren: Array<{
            id: string;
            nickname: string;
            phone: string;
            level: string;
        }>;
    }>;
    updateProfile(req: Request, dto: UpdateProfileDTO): Promise<UserInfo>;
    supplementInviter(req: Request, dto: SupplementInviterDTO): Promise<UserInfo>;
    getInviteCode(req: Request): Promise<{
        inviteCode: string;
    }>;
}

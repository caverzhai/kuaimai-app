import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { LoginResponse, SupplementInviterDTO, UpdateProfileDTO, UserInfo, UserLoginDTO, UserRegisterDTO } from '@shared/api.interface';
export declare class UsersService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    register(dto: UserRegisterDTO): Promise<LoginResponse>;
    login(dto: UserLoginDTO): Promise<LoginResponse>;
    getCurrentUser(userId: string): Promise<UserInfo>;
    updateProfile(userId: string, dto: UpdateProfileDTO): Promise<UserInfo>;
    supplementInviter(userId: string, dto: SupplementInviterDTO): Promise<UserInfo>;
    getOrGenerateInviteCode(userId: string): Promise<{
        inviteCode: string;
    }>;
    private findParentForSliding;
    private makeToken;
    private getLevelLayer;
    private toUserInfo;
}

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export declare class FriendsService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    getFriendList(userId: string): Promise<{
        items: {
            id: string;
            friendId: string;
            nickname: string;
            avatarUrl: string;
            phone: string;
            createdAt: string;
        }[];
    }>;
    getFriendRequests(userId: string): Promise<{
        items: {
            id: string;
            requesterId: string;
            nickname: string;
            avatarUrl: string;
            createdAt: string;
        }[];
    }>;
    addFriend(userId: string, friendPhone: string): Promise<{
        success: boolean;
        message: string;
    }>;
    respondFriendRequest(userId: string, requestId: string, accept: boolean): Promise<{
        success: boolean;
        message: string;
    }>;
    createPersonalRoom(userId: string, data: {
        name: string;
        memberIds: string[];
    }): Promise<{
        id: string;
        name: string;
        type: string;
    }>;
}

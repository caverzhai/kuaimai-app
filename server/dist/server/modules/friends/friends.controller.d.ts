import type { Request } from 'express';
import { FriendsService } from './friends.service';
export declare class FriendsController {
    private readonly friendsService;
    constructor(friendsService: FriendsService);
    getFriendList(req: Request): Promise<{
        items: {
            id: string;
            friendId: string;
            nickname: string;
            avatarUrl: string;
            phone: string;
            createdAt: string;
        }[];
    }>;
    getFriendRequests(req: Request): Promise<{
        items: {
            id: string;
            requesterId: string;
            nickname: string;
            avatarUrl: string;
            createdAt: string;
        }[];
    }>;
    addFriend(req: Request, body: {
        phone: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    respondFriendRequest(id: string, req: Request, body: {
        accept: boolean;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    createPersonalRoom(req: Request, body: {
        name: string;
        memberIds: string[];
    }): Promise<{
        id: string;
        name: string;
        type: string;
    }>;
}

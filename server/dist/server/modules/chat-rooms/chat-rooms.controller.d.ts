import type { Request } from 'express';
import { ChatRoomsService } from './chat-rooms.service';
export declare class ChatRoomsController {
    private readonly chatRoomsService;
    constructor(chatRoomsService: ChatRoomsService);
    getRoomList(req: Request): Promise<{
        items: {
            id: string;
            name: string;
            description: string;
            type: string;
            createdBy: string;
            maxMicCount: number;
            memberCount: number;
            micSlots: {
                slotIndex: number;
                userId: string;
                nickname: string;
                avatarUrl: string;
            }[];
            createdAt: string;
        }[];
    }>;
    createRoom(req: Request, body: {
        name: string;
        description?: string;
        type: 'public' | 'personal';
        memberIds?: string[];
    }): Promise<{
        id: string;
        name: string;
        type: string;
    }>;
    createApplication(req: Request, body: {
        roomName: string;
        description: string;
        usageTime: string;
        contactPhone: string;
    }): Promise<{
        success: boolean;
        application: {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            description: string;
            scheduledStartTime: Date;
            scheduledEndTime: Date;
            roomId: string;
            approvedBy: string;
            roomName: string;
            usageTime: string;
            contactPhone: string;
        };
    }>;
    getApplications(req: Request): Promise<{
        items: any;
    }>;
    approveApplication(id: string, req: Request, body: {
        roomName?: string;
        description?: string;
    }): Promise<{
        success: boolean;
        roomId: string;
        message: string;
    }>;
    rejectApplication(id: string, req: Request): Promise<{
        success: boolean;
        message: string;
    }>;
    getAllRoomsForAdmin(req: Request): Promise<{
        items: {
            creatorNickname: string;
            creatorPhone: string;
            scheduledStartTime: string;
            scheduledEndTime: string;
            createdAt: string;
            isExpired: boolean;
            id: string;
            name: string;
            description: string;
            type: string;
            createdBy: string;
            isActive: boolean;
        }[];
    }>;
    deleteRoomByAdmin(id: string, req: Request): Promise<{
        success: boolean;
    }>;
    getRoomDetail(id: string, req: Request): Promise<{
        id: string;
        name: string;
        description: string;
        type: string;
        maxMicCount: number;
        myRole: string;
        isMuted: boolean;
        micSlots: {
            slotIndex: number;
            userId: string;
            nickname: string;
            avatarUrl: string;
        }[];
    }>;
    muteUser(id: string, req: Request, body: {
        userId: string;
        muted: boolean;
    }): Promise<{
        success: boolean;
    }>;
    blockUser(id: string, req: Request, body: {
        userId: string;
        blocked: boolean;
    }): Promise<{
        success: boolean;
    }>;
    requestMic(id: string, req: Request): Promise<{
        success: boolean;
        message: string;
    }>;
    getMicRequests(id: string, req: Request): Promise<{
        items: any;
    }>;
    approveMicRequest(id: string, requestId: string, req: Request): Promise<{
        success: boolean;
        message: string;
    }>;
    rejectMicRequest(id: string, requestId: string, req: Request): Promise<{
        success: boolean;
        message: string;
    }>;
    takeMic(id: string, req: Request, body?: {
        slotIndex?: number;
    }): Promise<{
        success: boolean;
        slotIndex: number;
        message: string;
    } | {
        success: boolean;
        slotIndex: number;
        message?: undefined;
    }>;
    leaveMic(id: string, req: Request): Promise<{
        success: boolean;
    }>;
    assignHost(id: string, req: Request, body: {
        userId: string;
        slotIndex: number;
    }): Promise<{
        success: boolean;
    }>;
    closeRoom(id: string, req: Request): Promise<{
        success: boolean;
    }>;
    getBlockedWords(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            word: string;
        }[];
    }>;
    addBlockedWord(req: Request, body: {
        word: string;
    }): Promise<{
        success: boolean;
    }>;
    removeBlockedWord(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}

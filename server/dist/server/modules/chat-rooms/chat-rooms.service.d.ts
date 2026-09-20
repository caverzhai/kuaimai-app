import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export declare class ChatRoomsService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    private scheduledTimer;
    private startScheduledTask;
    private cleanupCounter;
    getRoomList(userId: string): Promise<{
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
    createRoom(userId: string, userPhone: string, data: {
        name: string;
        description?: string;
        type: 'public' | 'personal';
        memberIds?: string[];
    }): Promise<{
        id: string;
        name: string;
        type: string;
    }>;
    getRoomDetail(roomId: string, userId: string): Promise<{
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
    muteUser(roomId: string, operatorId: string, targetUserId: string, muted: boolean): Promise<{
        success: boolean;
    }>;
    blockUser(roomId: string, operatorId: string, targetUserId: string, blocked: boolean): Promise<{
        success: boolean;
    }>;
    requestMic(roomId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getMicRequests(roomId: string, userId: string, isAdmin: boolean): Promise<{
        items: any;
    }>;
    approveMicRequest(roomId: string, operatorId: string, requestId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    rejectMicRequest(roomId: string, operatorId: string, requestId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    takeMic(roomId: string, userId: string, slotIndex?: number): Promise<{
        success: boolean;
        slotIndex: number;
        message: string;
    } | {
        success: boolean;
        slotIndex: number;
        message?: undefined;
    }>;
    leaveMic(roomId: string, userId: string): Promise<{
        success: boolean;
    }>;
    assignHost(roomId: string, operatorId: string, targetUserId: string, slotIndex: number): Promise<{
        success: boolean;
    }>;
    closeRoom(roomId: string, operatorPhone: string): Promise<{
        success: boolean;
    }>;
    activateScheduledRooms(): Promise<{
        activated: number;
    }>;
    closeExpiredRooms(): Promise<{
        closed: number;
    }>;
    getAllRoomsForAdmin(): Promise<{
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
    deleteRoomByAdmin(roomId: string, operatorPhone: string): Promise<{
        success: boolean;
    }>;
    cleanupExpiredRooms(): Promise<{
        deleted: number;
    }>;
    getBlockedWords(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            word: string;
        }[];
    }>;
    addBlockedWord(word: string, operatorPhone: string): Promise<{
        success: boolean;
    }>;
    removeBlockedWord(id: string, operatorPhone: string): Promise<{
        success: boolean;
    }>;
    filterBlockedWords(text: string, blockedWords: string[]): string;
    private checkPermission;
    createApplication(userId: string, data: {
        roomName: string;
        description: string;
        usageTime: string;
        contactPhone: string;
        scheduledStartTime?: string;
        scheduledEndTime?: string;
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
    getApplications(userId: string, isAdmin: boolean): Promise<{
        items: any;
    }>;
    approveApplication(operatorId: string, applicationId: string, updateData?: {
        roomName?: string;
        description?: string;
    }): Promise<{
        success: boolean;
        roomId: string;
        message: string;
    }>;
    rejectApplication(operatorId: string, applicationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}

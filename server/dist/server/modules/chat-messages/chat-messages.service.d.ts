import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ChatRoomsService } from '../chat-rooms/chat-rooms.service';
export declare class ChatMessagesService {
    private readonly db;
    private readonly chatRoomsService;
    private readonly logger;
    constructor(db: PostgresJsDatabase, chatRoomsService: ChatRoomsService);
    sendMessage(roomId: string, userId: string, data: {
        type: 'text' | 'image' | 'audio';
        content: string;
        duration?: number;
    }): Promise<{
        id: string;
        roomId: string;
        userId: string;
        type: string;
        content: string;
        duration: number;
        createdAt: string;
    }>;
    getMessages(roomId: string, userId: string, limit?: number): Promise<{
        items: {
            id: string;
            roomId: string;
            userId: string;
            nickname: string;
            avatarUrl: string;
            type: string;
            content: string;
            duration: number;
            createdAt: string;
        }[];
    }>;
    cleanExpiredMessages(): Promise<{
        cleaned: number;
    }>;
}

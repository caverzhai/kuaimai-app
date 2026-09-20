import type { Request } from 'express';
import { ChatMessagesService } from './chat-messages.service';
export declare class ChatMessagesController {
    private readonly chatMessagesService;
    constructor(chatMessagesService: ChatMessagesService);
    sendMessage(roomId: string, req: Request, body: {
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
    getMessages(roomId: string, req: Request, limit?: string): Promise<{
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
}

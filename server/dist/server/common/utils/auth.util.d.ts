export interface TokenPayload {
    userId: string;
    phone: string;
    level: string;
    isInvited: boolean;
}
export declare function generateToken(payload: TokenPayload): string;
export declare function verifyToken(token: string): TokenPayload | null;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function verifyLegacyPassword(password: string, hash: string): boolean;
export declare function generateOrderNo(prefix: string): string;
export declare function generateInviteCode(length?: number): string;

export declare function generateToken(payload: Record<string, unknown>): string;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, hash: string): boolean;
export declare function generateOrderNo(prefix: string): string;
export declare function generateInviteCode(length?: number): string;

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { UpgradeCenterInfo, UpgradeTaskInfo } from '@shared/api.interface';
export declare class UpgradeService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    getUpgradeCenter(userId: string): Promise<UpgradeCenterInfo>;
    startTask(taskId: string, userId: string): Promise<UpgradeTaskInfo>;
    checkMallTaskComplete(userId: string, mallOrderId: string, totalAmount: string): Promise<void>;
    checkConsultTaskComplete(userId: string, orderId: string, consultantId: string, amount: string): Promise<void>;
    private completeTask;
    private tryUpgrade;
    private generateUniqueInviteCode;
    private ensureTasks;
    private getAncestorFromPath;
    getAncestorUserId(userId: string, level: number): Promise<string | null>;
    private mapTaskInfo;
}

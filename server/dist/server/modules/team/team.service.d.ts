import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { InviteInfo, TeamInfo } from '@shared/api.interface';
export declare class TeamService {
    private readonly db;
    private readonly logger;
    constructor(db: PostgresJsDatabase);
    getTeamTree(userId: string, isInvited: boolean): Promise<TeamInfo>;
    getInviteInfo(userId: string, userLevel: string): Promise<InviteInfo>;
    private generateAndSaveInviteCode;
}

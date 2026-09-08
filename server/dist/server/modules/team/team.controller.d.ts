import type { Request } from 'express';
import { TeamService } from './team.service';
import type { InviteInfo, TeamInfo } from '@shared/api.interface';
export declare class TeamController {
    private readonly teamService;
    constructor(teamService: TeamService);
    getTeamTree(req: Request): Promise<TeamInfo>;
    getInviteInfo(req: Request): Promise<InviteInfo>;
}

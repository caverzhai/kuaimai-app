import type { Request } from 'express';
import type { UpgradeCenterInfo, UpgradeTaskInfo } from '@shared/api.interface';
import { UpgradeService } from './upgrade.service';
export declare class UpgradeController {
    private readonly upgradeService;
    constructor(upgradeService: UpgradeService);
    getUpgradeCenter(req: Request): Promise<UpgradeCenterInfo>;
    startTask(taskId: string, req: Request): Promise<UpgradeTaskInfo>;
}

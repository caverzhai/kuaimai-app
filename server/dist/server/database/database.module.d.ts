import { OnModuleInit } from '@nestjs/common';
export declare const DRIZZLE_DATABASE = "DRIZZLE_DATABASE";
export declare class DatabaseModule implements OnModuleInit {
    private readonly db;
    constructor(db: any);
    onModuleInit(): Promise<void>;
}

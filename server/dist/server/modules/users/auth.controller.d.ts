import { UsersService } from './users.service';
import type { LoginResponse, UserLoginDTO, UserRegisterDTO } from '@shared/api.interface';
export declare class AuthController {
    private readonly usersService;
    constructor(usersService: UsersService);
    register(dto: UserRegisterDTO): Promise<LoginResponse>;
    login(dto: UserLoginDTO): Promise<LoginResponse>;
}

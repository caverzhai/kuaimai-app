"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const exception_interface_1 = require("../interfaces/exception.interface");
const api_response_code_1 = require("../constants/api_response_code");
let GlobalExceptionFilter = class GlobalExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        if (response.headersSent) {
            return;
        }
        let errorResponse;
        let httpStatus;
        if (exception instanceof exception_interface_1.BusinessException) {
            httpStatus = exception.httpStatus;
            errorResponse = {
                error: {
                    code: exception.code,
                    message: exception.message,
                    details: exception.details,
                    fieldErrors: exception.fieldErrors,
                    timestamp: Date.now(),
                },
            };
        }
        else if (exception instanceof common_1.HttpException) {
            httpStatus = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            errorResponse = {
                error: {
                    code: api_response_code_1.HTTP_STATUS_TO_RESPONSE_CODE_MAP[httpStatus],
                    message: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
                    details: typeof exceptionResponse === 'object' ? JSON.stringify(exceptionResponse) : undefined,
                    timestamp: Date.now(),
                },
            };
        }
        else if (typeof exception === 'object' &&
            exception !== null &&
            exception.code === '22P02') {
            httpStatus = common_1.HttpStatus.NOT_FOUND;
            errorResponse = {
                error: {
                    code: api_response_code_1.ResponseCode.NOT_FOUND,
                    message: '资源不存在',
                    timestamp: Date.now(),
                },
            };
        }
        else {
            httpStatus = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            errorResponse = {
                error: {
                    code: api_response_code_1.ResponseCode.INTERNAL_ERROR,
                    message: '服务器内部错误',
                    stack: exception.stack,
                    cause: exception.cause,
                    timestamp: Date.now(),
                },
            };
        }
        response.status(httpStatus).json(errorResponse);
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=exception.filter.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_TYPE = exports.TASK_STATUS = exports.CONSULT_ORDER_STATUS_NAMES = exports.CONSULT_ORDER_STATUS = exports.MALL_ORDER_STATUS_NAMES = exports.MALL_ORDER_STATUS = exports.LEVEL_LAYERS = exports.LEVEL_NAMES = exports.LEVELS = void 0;
exports.LEVELS = {
    JUNIOR: 'junior',
    LEVEL_4: 'level_4',
    LEVEL_5: 'level_5',
    LEVEL_6: 'level_6',
    LEVEL_7: 'level_7',
    LEVEL_8: 'level_8',
};
exports.LEVEL_NAMES = {
    junior: '初级',
    level_4: '4级咨询师',
    level_5: '5级咨询师',
    level_6: '6级咨询师',
    level_7: '7级咨询团',
    level_8: '8级咨询团',
};
exports.LEVEL_LAYERS = {
    level_4: 4,
    level_5: 5,
    level_6: 6,
    level_7: 7,
    level_8: 8,
};
exports.MALL_ORDER_STATUS = {
    PENDING_PAYMENT: 'pending_payment',
    PENDING_REVIEW: 'pending_review',
    PENDING_SHIPMENT: 'pending_shipment',
    PENDING_DELIVERY: 'pending_delivery',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
exports.MALL_ORDER_STATUS_NAMES = {
    pending_payment: '待付款',
    pending_review: '待审核收款',
    pending_shipment: '待发货',
    pending_delivery: '待收货',
    completed: '已完成',
    cancelled: '已取消',
};
exports.CONSULT_ORDER_STATUS = {
    PENDING_PAYMENT: 'pending_payment',
    PENDING_CONFIRM: 'pending_confirm',
    IN_SERVICE: 'in_service',
    PENDING_REVIEW: 'pending_review',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
exports.CONSULT_ORDER_STATUS_NAMES = {
    pending_payment: '待付款',
    pending_confirm: '待确认收款',
    in_service: '服务中',
    pending_review: '待审核作业',
    completed: '已完成',
    cancelled: '已取消',
};
exports.TASK_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
};
exports.TASK_TYPE = {
    MALL_PURCHASE: 'mall_purchase',
    CONSULT_SERVICE: 'consult_service',
};
//# sourceMappingURL=api.interface.js.map
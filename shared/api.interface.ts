// 共享类型定义
export interface UserInfo {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl?: string;
  gender?: string;
  age?: number;
  level: string;
  isInvited: boolean;
  inviterId?: string;
  parentId?: string;
  inviteCode?: string;
  receiveAddress?: string;
  receivePhone?: string;
  industry?: string;
  qualification?: string;
  serviceStandard?: string;
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
  companyQrcodeUrl?: string;
  businessLicenseUrl?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  realName?: string;
  wechatId?: string;
  companyAuditStatus?: string;
  totalConsultIncome: string;
  thresholdBlocked: boolean;
  thresholdTriggeredAt?: string;
  pendingReclaimAmount: string;
  overflowLossAmount: string;
  directInviteCount: number;
  teamTotalCount: number;
  treeLevel: number;
  createdAt: string;
}

export interface UserRegisterDTO {
  phone: string;
  nickname: string;
  password: string;
  avatarUrl?: string;
  inviteCode?: string;
}

export interface UserLoginDTO {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface ProductInfo {
  id: string;
  name: string;
  price: string;
  description?: string;
  category?: string;
  spec?: string;
  mainImages: { url: string }[];
  detailImages: { url: string }[];
  status: string;
  sortOrder: number;
  createdAt: string;
}

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  keyword?: string;
}

export interface ProductListResponse {
  items: ProductInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MallOrderInfo {
  id: string;
  orderNo: string;
  userId: string;
  productId: string;
  productName: string;
  productImage?: string;
  price: string;
  quantity: number;
  totalAmount: string;
  receiveName?: string;
  receivePhone?: string;
  receiveAddress?: string;
  status: string;
  paymentScreenshotUrl?: string;
  paymentConfirmedAt?: string;
  logisticsCompany?: string;
  logisticsNo?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
  autoConfirmDeadline?: string;
  createdAt: string;
}

export interface CreateMallOrderDTO {
  productId: string;
  quantity: number;
  receiveName: string;
  receivePhone: string;
  receiveAddress: string;
}

export interface MallOrderListResponse {
  items: MallOrderInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConsultOrderInfo {
  id: string;
  orderNo: string;
  studentId: string;
  consultantId: string;
  consultant?: UserInfo;
  student?: UserInfo;
  serviceType: string;
  amount: string;
  taskLevelFrom?: string;
  taskLevelTo?: string;
  taskIndex?: number;
  status: string;
  paymentScreenshotUrl?: string;
  paymentConfirmedAt?: string;
  workScreenshotUrl?: string;
  workSubmittedAt?: string;
  workReviewedAt?: string;
  reviewRemark?: string;
  isOverflow: boolean;
  overflowToGroup: boolean;
  autoConfirmDeadline?: string;
  createdAt: string;
}

export interface CreateConsultOrderDTO {
  consultantId: string;
  serviceType: string;
  amount: number;
  taskLevelFrom?: string;
  taskLevelTo?: string;
  taskIndex?: number;
}

export interface ConsultOrderListResponse {
  items: ConsultOrderInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConsultantInfo {
  id: string;
  nickname: string;
  avatarUrl?: string;
  level: string;
  phone?: string;
  industry?: string;
  qualification?: string;
  serviceStandard?: string;
  directInviteCount: number;
}

export interface ConsultantListQuery {
  page?: number;
  pageSize?: number;
  industry?: string;
  level?: string;
  keyword?: string;
}

export interface ConsultantListResponse {
  items: ConsultantInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpgradeTaskInfo {
  id: string;
  userId: string;
  fromLevel: string;
  toLevel: string;
  taskIndex: number;
  taskType: string;
  title: string;
  amount: string;
  status: string;
  targetId?: string;
  orderId?: string;
  mallOrderId?: string;
  completedAt?: string;
  createdAt: string;
}

export interface UpgradeCenterInfo {
  currentLevel: string;
  nextLevel?: string;
  tasks: UpgradeTaskInfo[];
}

export interface TeamTreeNode {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  level: string;
  children: TeamTreeNode[];
}

export interface TeamInfo {
  tree: TeamTreeNode;
  directInviteCount: number;
  teamTotalCount: number;
}

export interface InviteRecordInfo {
  id: string;
  inviterId: string;
  inviteeId: string;
  invitee?: {
    nickname: string;
    avatarUrl?: string;
    phone: string;
    level: string;
  };
  inviteCode: string;
  registeredAt: string;
}

export interface InviteInfo {
  inviteCode: string;
  records: InviteRecordInfo[];
  total: number;
}

export interface PaymentScreenshotDTO {
  screenshotUrl: string;
}

export interface WorkScreenshotDTO {
  screenshotUrl: string;
}

export interface ShipDTO {
  logisticsCompany: string;
  logisticsNo: string;
}

export interface ReviewDTO {
  passed: boolean;
  remark?: string;
}

export interface UpdateProfileDTO {
  nickname?: string;
  avatarUrl?: string;
  gender?: string;
  age?: number;
  receiveAddress?: string;
  receivePhone?: string;
  industry?: string;
  qualification?: string;
  serviceStandard?: string;
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
  companyQrcodeUrl?: string;
  businessLicenseUrl?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  realName?: string;
  wechatId?: string;
}

export interface SupplementInviterDTO {
  inviteCode: string;
}

export interface PlatformQrcodeInfo {
  id: string;
  type: string;
  wechatQrcodeUrl?: string;
  alipayQrcodeUrl?: string;
}

export interface ProductCategoryInfo {
  id: string;
  name: string;
  sortOrder: number;
}

export interface IndustryInfo {
  id: string;
  name: string;
  sortOrder: number;
}

export const LEVELS = {
  JUNIOR: 'junior',
  LEVEL_4: 'level_4',
  LEVEL_5: 'level_5',
  LEVEL_6: 'level_6',
  LEVEL_7: 'level_7',
  LEVEL_8: 'level_8',
} as const;

export const LEVEL_NAMES: Record<string, string> = {
  junior: '初级',
  level_4: '4级咨询师',
  level_5: '5级咨询师',
  level_6: '6级咨询师',
  level_7: '7级咨询团',
  level_8: '8级咨询团',
};

export const LEVEL_LAYERS: Record<string, number> = {
  level_4: 4,
  level_5: 5,
  level_6: 6,
  level_7: 7,
  level_8: 8,
};

export const MALL_ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PENDING_REVIEW: 'pending_review',
  PENDING_SHIPMENT: 'pending_shipment',
  PENDING_DELIVERY: 'pending_delivery',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const MALL_ORDER_STATUS_NAMES: Record<string, string> = {
  pending_payment: '待付款',
  pending_review: '待审核收款',
  pending_shipment: '待发货',
  pending_delivery: '待收货',
  completed: '已完成',
  cancelled: '已取消',
};

export const CONSULT_ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PENDING_CONFIRM: 'pending_confirm',
  IN_SERVICE: 'in_service',
  PENDING_REVIEW: 'pending_review',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const CONSULT_ORDER_STATUS_NAMES: Record<string, string> = {
  pending_payment: '待付款',
  pending_confirm: '待确认收款',
  in_service: '服务中',
  pending_review: '待审核作业',
  completed: '已完成',
  cancelled: '已取消',
};

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const TASK_TYPE = {
  MALL_PURCHASE: 'mall_purchase',
  CONSULT_SERVICE: 'consult_service',
} as const;

import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export async function login(phone: string, password: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/auth/login',
      method: 'POST',
      data: { phone, password },
    });
    return response.data;
  } catch (error) {
    logger.error('登录失败', error);
    throw error;
  }
}

export async function register(data: {
  phone: string;
  nickname: string;
  password: string;
  avatarUrl?: string;
  inviteCode?: string;
  securityQuestion?: string;
  securityAnswer?: string;
}) {
  try {
    const response = await axiosForBackend({
      url: '/api/auth/register',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('注册失败', error);
    throw error;
  }
}

export async function getSecurityQuestion(phone: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/auth/get-security-question',
      method: 'POST',
      data: { phone },
    });
    return response.data;
  } catch (error) {
    logger.error('获取安全问题失败', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const response = await axiosForBackend({
      url: '/api/users/me',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取用户信息失败', error);
    throw error;
  }
}

export async function getRelationTree() {
  try {
    const response = await axiosForBackend({
      url: '/api/users/relation-tree',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取关系树失败', error);
    throw error;
  }
}

export async function getAssessment() {
  try {
    const response = await axiosForBackend({
      url: '/api/users/assessment',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取考核信息失败', error);
    throw error;
  }
}

export async function submitClonePhone(newPhone: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/users/clone-phone',
      method: 'POST',
      data: { newPhone },
    });
    return response.data;
  } catch (error) {
    logger.error('提交分身手机号失败', error);
    throw error;
  }
}

export async function updateProfile(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/users/profile',
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新资料失败', error);
    throw error;
  }
}

export async function changePassword(oldPassword: string, newPassword: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/users/change-password',
      method: 'POST',
      data: { oldPassword, newPassword },
    });
    return response.data;
  } catch (error) {
    logger.error('修改密码失败', error);
    throw error;
  }
}

export async function supplementInviter(inviteCode: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/users/supplement-inviter',
      method: 'POST',
      data: { inviteCode },
    });
    return response.data;
  } catch (error) {
    logger.error('补充邀请人失败', error);
    throw error;
  }
}

export async function getProductList(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/products',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取商品列表失败', error);
    throw error;
  }
}

export async function getProductDetail(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/products/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取商品详情失败', error);
    throw error;
  }
}

export async function getProductCategories() {
  try {
    const response = await axiosForBackend({
      url: '/api/products/categories',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取商品分类失败', error);
    throw error;
  }
}

export async function createMallOrder(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/mall-orders',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建商城订单失败', error);
    throw error;
  }
}

export async function getMallOrderDetail(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/mall-orders/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取订单详情失败', error);
    throw error;
  }
}

export async function getMyMallOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/mall-orders/my',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的订单失败', error);
    throw error;
  }
}

export async function uploadMallPayment(id: string, screenshotUrl: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/mall-orders/${id}/payment`,
      method: 'POST',
      data: { screenshotUrl },
    });
    return response.data;
  } catch (error) {
    logger.error('上传付款截图失败', error);
    throw error;
  }
}

export async function confirmMallDelivery(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/mall-orders/${id}/confirm-delivery`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('确认收货失败', error);
    throw error;
  }
}

export async function getConsultantList(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/consultants',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取咨询师列表失败', error);
    throw error;
  }
}

export async function getConsultantDetail(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consultants/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取咨询师详情失败', error);
    throw error;
  }
}

export async function getIndustries() {
  try {
    const response = await axiosForBackend({
      url: '/api/consultants/industries',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取行业列表失败', error);
    throw error;
  }
}

export async function createConsultOrder(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/consult-orders',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建咨询订单失败', error);
    throw error;
  }
}

export async function getConsultOrderDetail(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consult-orders/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取咨询订单详情失败', error);
    throw error;
  }
}

export async function getMyConsultOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/consult-orders/my',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取我的咨询订单失败', error);
    throw error;
  }
}

export async function getReceivedConsultOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/consult-orders/received',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取收到的咨询订单失败', error);
    throw error;
  }
}

export async function confirmConsultPayment(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consult-orders/${id}/confirm-payment`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('确认咨询收款失败', error);
    throw error;
  }
}

export async function reviewConsultWork(id: string, passed: boolean, remark?: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consult-orders/${id}/review-work`,
      method: 'POST',
      data: { passed, remark },
    });
    return response.data;
  } catch (error) {
    logger.error('审核咨询作业失败', error);
    throw error;
  }
}

export async function uploadConsultPayment(id: string, screenshotUrl: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consult-orders/${id}/payment`,
      method: 'POST',
      data: { screenshotUrl },
    });
    return response.data;
  } catch (error) {
    logger.error('上传咨询付款截图失败', error);
    throw error;
  }
}

export async function uploadWork(id: string, screenshotUrl: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/consult-orders/${id}/work`,
      method: 'POST',
      data: { screenshotUrl },
    });
    return response.data;
  } catch (error) {
    logger.error('上传作业失败', error);
    throw error;
  }
}

export async function getUpgradeCenter() {
  try {
    const response = await axiosForBackend({
      url: '/api/upgrade/center',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取升级中心失败', error);
    throw error;
  }
}

export async function startUpgradeTask(taskId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/upgrade/tasks/${taskId}/start`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('开始升级任务失败', error);
    throw error;
  }
}

export async function confirmNextLevel() {
  try {
    const response = await axiosForBackend({
      url: '/api/upgrade/confirm',
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('确认升级失败', error);
    throw error;
  }
}

export async function getMyTeam() {
  try {
    const response = await axiosForBackend({
      url: '/api/team/tree',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取团队树失败', error);
    throw error;
  }
}

export async function getInviteInfo() {
  try {
    const response = await axiosForBackend({
      url: '/api/team/invite',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取邀请信息失败', error);
    throw error;
  }
}

export async function getFinanceInfo() {
  try {
    const response = await axiosForBackend({
      url: '/api/finance/info',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取资金信息失败', error);
    throw error;
  }
}

export async function getPlatformQrcode(type: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/platform-qrcode/${type}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取平台收款码失败', error);
    throw error;
  }
}

export async function getOrderQrcode(orderId: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/mall-orders/' + orderId + '/qrcode',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取订单收款码失败', error);
    throw error;
  }
}
export async function getAdminProducts(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/products',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取后台商品列表失败', error);
    throw error;
  }
}

export async function createAdminProduct(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/products',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建商品失败', error);
    throw error;
  }
}

export async function updateAdminProduct(id: string, data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/products/${id}`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新商品失败', error);
    throw error;
  }
}

export async function getAdminMallOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/mall-orders',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取后台商城订单失败', error);
    throw error;
  }
}

export async function reviewMallPayment(id: string, passed: boolean) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/mall-orders/${id}/review-payment`,
      method: 'POST',
      data: { passed },
    });
    return response.data;
  } catch (error) {
    logger.error('审核收款失败', error);
    throw error;
  }
}

export async function shipMallOrder(id: string, data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/mall-orders/${id}/ship`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('发货失败', error);
    throw error;
  }
}

export async function getAdminUsers(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/users',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取用户列表失败', error);
    throw error;
  }
}

export async function updateAdminUserPhone(userId: string, phone: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/users/${userId}/phone`,
      method: 'PATCH',
      data: { phone },
    });
    return response.data;
  } catch (error) {
    logger.error('修改用户手机号失败', error);
    throw error;
  }
}

export async function getAdminCompanyAudits(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/company-audits',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取公司审核列表失败', error);
    throw error;
  }
}

export async function reviewCompanyAudit(id: string, passed: boolean, remark?: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/company-audits/${id}/review`,
      method: 'POST',
      data: { passed, remark },
    });
    return response.data;
  } catch (error) {
    logger.error('审核公司资质失败', error);
    throw error;
  }
}

export async function updatePlatformQrcode(type: string, data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: `/api/platform-qrcode/${type}`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新平台收款码失败', error);
    throw error;
  }
}

export async function getAdminConsultOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/consult-orders',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取后台咨询订单失败', error);
    throw error;
  }
}

// ============================================================
// 聊天室 API
// ============================================================

export async function getChatRoomList() {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取聊天室列表失败', error);
    throw error;
  }
}

export async function createChatRoom(data: { name: string; description?: string; type: 'public' | 'personal'; memberIds?: string[] }) {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建聊天室失败', error);
    throw error;
  }
}

export async function createRoomApplication(data: { roomName: string; description: string; usageTime: string; contactPhone: string; scheduledStartTime?: string; scheduledEndTime?: string }) {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms/applications',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('提交聊天室申请失败', error);
    throw error;
  }
}

export async function getRoomApplications() {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms/applications',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取聊天室申请列表失败', error);
    throw error;
  }
}

export async function approveRoomApplication(applicationId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/applications/${applicationId}/approve`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('同意聊天室申请失败', error);
    throw error;
  }
}

export async function rejectRoomApplication(applicationId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/applications/${applicationId}/reject`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('拒绝聊天室申请失败', error);
    throw error;
  }
}

export async function deleteRoomApplication(applicationId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/applications/${applicationId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除聊天室申请失败', error);
    throw error;
  }
}

export async function getChatRoomDetail(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取聊天室详情失败', error);
    throw error;
  }
}

export async function getChatRoomMembers(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/members`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取聊天室成员列表失败', error);
    throw error;
  }
}

export async function sendChatMessage(roomId: string, data: { type: 'text' | 'image' | 'audio'; content: string; duration?: number }) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-messages/${roomId}`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('发送消息失败', error);
    throw error;
  }
}

export async function getChatMessages(roomId: string, limit?: number) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-messages/${roomId}`,
      method: 'GET',
      params: limit ? { limit } : {},
    });
    return response.data;
  } catch (error) {
    logger.error('获取消息失败', error);
    throw error;
  }
}

export async function requestMic(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/request`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('申请上麦失败', error);
    throw error;
  }
}

export async function getMicRequests(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/requests`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取上麦申请列表失败', error);
    throw error;
  }
}

export async function approveMicRequest(roomId: string, requestId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/requests/${requestId}/approve`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('同意上麦申请失败', error);
    throw error;
  }
}

export async function rejectMicRequest(roomId: string, requestId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/requests/${requestId}/reject`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('拒绝上麦申请失败', error);
    throw error;
  }
}

export async function takeMic(roomId: string, slotIndex?: number) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/take`,
      method: 'POST',
      data: slotIndex !== undefined ? { slotIndex } : {},
    });
    return response.data;
  } catch (error) {
    logger.error('上麦失败', error);
    throw error;
  }
}

export async function leaveMic(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mic/leave`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('下麦失败', error);
    throw error;
  }
}

export async function muteUser(roomId: string, userId: string, muted: boolean) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/mute`,
      method: 'POST',
      data: { userId, muted },
    });
    return response.data;
  } catch (error) {
    logger.error('禁言操作失败', error);
    throw error;
  }
}

export async function blockUser(roomId: string, userId: string, blocked: boolean) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/block`,
      method: 'POST',
      data: { userId, blocked },
    });
    return response.data;
  } catch (error) {
    logger.error('拉黑操作失败', error);
    throw error;
  }
}

export async function closeChatRoom(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/${roomId}/close`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('关闭聊天室失败', error);
    throw error;
  }
}

// 管理员：获取所有聊天室（包括已结束的）
export async function adminGetAllChatRooms() {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms/admin/all',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取所有聊天室失败', error);
    throw error;
  }
}

// 管理员：删除聊天室
export async function adminDeleteChatRoom(roomId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/admin/${roomId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除聊天室失败', error);
    throw error;
  }
}

export async function getBlockedWords() {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms/blocked-words/list',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取屏蔽词失败', error);
    throw error;
  }
}

export async function addBlockedWord(word: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/chat-rooms/blocked-words',
      method: 'POST',
      data: { word },
    });
    return response.data;
  } catch (error) {
    logger.error('添加屏蔽词失败', error);
    throw error;
  }
}

export async function removeBlockedWord(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/chat-rooms/blocked-words/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除屏蔽词失败', error);
    throw error;
  }
}

// ============================================================
// 好友 API
// ============================================================

export async function getFriendList() {
  try {
    const response = await axiosForBackend({
      url: '/api/friends',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取好友列表失败', error);
    throw error;
  }
}

export async function getFriendRequests() {
  try {
    const response = await axiosForBackend({
      url: '/api/friends/requests',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取好友请求失败', error);
    throw error;
  }
}

export async function addFriend(phone: string) {
  try {
    const response = await axiosForBackend({
      url: '/api/friends',
      method: 'POST',
      data: { phone },
    });
    return response.data;
  } catch (error) {
    logger.error('添加好友失败', error);
    throw error;
  }
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  try {
    const response = await axiosForBackend({
      url: `/api/friends/requests/${requestId}/respond`,
      method: 'POST',
      data: { accept },
    });
    return response.data;
  } catch (error) {
    logger.error('响应好友请求失败', error);
    throw error;
  }
}

export async function createPersonalChatRoom(data: { name: string; memberIds: string[] }) {
  try {
    const response = await axiosForBackend({
      url: '/api/friends/room',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建个人聊天室失败', error);
    throw error;
  }
}

// ============================================================
// OCR 身份证识别 API
// ============================================================

export async function recognizeIdCard(imageUrl: string, cardType: 'face' | 'back' = 'face') {
  try {
    const response = await axiosForBackend({
      url: '/api/ocr/idcard',
      method: 'POST',
      data: { imageUrl, cardType },
    });
    return response.data;
  } catch (error) {
    logger.error('身份证OCR识别失败', error);
    throw error;
  }
}

// ============================================================
// 商家 API（/api/seller）
// ============================================================

export async function getSellerProducts(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/products',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取商家商品列表失败', error);
    throw error;
  }
}

export async function createSellerProduct(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/products',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('商家创建商品失败', error);
    throw error;
  }
}

export async function updateSellerProduct(id: string, data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: `/api/seller/products/${id}`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('商家编辑商品失败', error);
    throw error;
  }
}

export async function toggleSellerProductStatus(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/seller/products/${id}/toggle-status`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('商家上下架失败', error);
    throw error;
  }
}

export async function getSellerOrders(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/orders',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取商家订单列表失败', error);
    throw error;
  }
}

export async function sellerShipOrder(id: string, data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: `/api/seller/orders/${id}/ship`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('商家发货失败', error);
    throw error;
  }
}

export async function getSellerManagementFees(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/management-fees',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取商家管理费列表失败', error);
    throw error;
  }
}

export async function payManagementFee(id: string, screenshotUrl: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/seller/management-fees/${id}/pay`,
      method: 'POST',
      data: { screenshotUrl },
    });
    return response.data;
  } catch (error) {
    logger.error('上传管理费支付凭证失败', error);
    throw error;
  }
}

export async function getSellerStats() {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/stats',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取商家统计失败', error);
    throw error;
  }
}

export async function applySeller(data: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/seller/apply',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('申请成为商家失败', error);
    throw error;
  }
}

// ============================================================
// 管理员：商家与管理费管理 API（/api/admin）
// ============================================================

export async function getAdminSellers(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/sellers',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取商家列表失败', error);
    throw error;
  }
}

export async function updateAdminSellerStatus(id: string, status: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/sellers/${id}/status`,
      method: 'PATCH',
      data: { status },
    });
    return response.data;
  } catch (error) {
    logger.error('更新商家状态失败', error);
    throw error;
  }
}

export async function getAdminManagementFees(params: Record<string, unknown>) {
  try {
    const response = await axiosForBackend({
      url: '/api/admin/management-fees',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取管理费列表失败', error);
    throw error;
  }
}

export async function confirmManagementFee(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/management-fees/${id}/confirm`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('确认管理费失败', error);
    throw error;
  }
}

export async function rejectManagementFee(id: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/management-fees/${id}/reject`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('拒绝管理费失败', error);
    throw error;
  }
}

// ============================================================
// 四星考核返还打款（达标自动生成申请，平台扫码支付）
// ============================================================

export async function getRefundList() {
  try {
    const response = await axiosForBackend({ url: '/api/admin/refunds', method: 'GET' });
    return response.data;
  } catch (error) {
    logger.error('获取返还打款申请失败', error);
    throw error;
  }
}

export async function confirmRefund(userId: string) {
  try {
    const response = await axiosForBackend({
      url: `/api/admin/refunds/${userId}/confirm`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('确认返还打款失败', error);
    throw error;
  }
}

// ============================================================
// 系统通知（管理员全员广播/个人通知；用户轮询拉取）
// ============================================================

export async function getNotificationsAll() {
  const response = await axiosForBackend({ url: '/api/notifications/all', method: 'GET' });
  return response.data;
}

export async function sendNotification(data: {
  target: 'all' | 'user';
  userId?: string;
  title: string;
  body: string;
  type?: 'system' | 'update';
  payload?: Record<string, any> | null;
}) {
  const response = await axiosForBackend({ url: '/api/notifications/send', method: 'POST', data });
  return response.data;
}

export async function getPendingNotifications(afterSeq: number) {
  const response = await axiosForBackend({
    url: `/api/notifications/pending?after=${afterSeq}`,
    method: 'GET',
  });
  return response.data;
}

export async function getPlatformNotice() {
  const response = await axiosForBackend({ url: '/api/notifications/current', method: 'GET' });
  return response.data;
}

export async function updatePlatformNotice(content: string) {
  const response = await axiosForBackend({ url: '/api/notifications/current', method: 'PUT', data: { content } });
  return response.data;
}

// ============================================================
// 1号会议室（语音会议室，纯 HTTP 准实时）
// ============================================================

export async function getMeetingList() {
  const response = await axiosForBackend({ url: '/api/meeting', method: 'GET' });
  return response.data;
}

export async function getMeetingState(id: string, sinceSeq = 0) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/state`,
    method: 'GET',
    params: { sinceSeq },
  });
  return response.data;
}

export async function meetingHeartbeat(id: string) {
  const response = await axiosForBackend({ url: `/api/meeting/${id}/heartbeat`, method: 'POST' });
  return response.data;
}

export async function meetingLeave(id: string) {
  const response = await axiosForBackend({ url: `/api/meeting/${id}/presence`, method: 'DELETE' });
  return response.data;
}

export async function meetingRaiseHand(id: string) {
  const response = await axiosForBackend({ url: `/api/meeting/${id}/hand`, method: 'POST' });
  return response.data;
}

export async function meetingCancelHand(id: string) {
  const response = await axiosForBackend({ url: `/api/meeting/${id}/hand/cancel`, method: 'POST' });
  return response.data;
}

export async function meetingApprove(id: string, userId: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/approve`,
    method: 'POST',
    data: { userId },
  });
  return response.data;
}

export async function meetingStop(id: string) {
  const response = await axiosForBackend({ url: `/api/meeting/${id}/stop`, method: 'POST' });
  return response.data;
}

export async function meetingAssignHost(id: string, userId: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/host`,
    method: 'POST',
    data: { userId },
  });
  return response.data;
}

export async function meetingUploadChunk(id: string, base64: string, duration: number) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/chunks`,
    method: 'POST',
    data: { base64, duration },
  });
  return response.data;
}

export async function getMeetingMessages(id: string, sinceTime?: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/messages`,
    method: 'GET',
    params: sinceTime ? { sinceTime } : {},
  });
  return response.data;
}

export async function meetingSendMessage(id: string, content: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/messages`,
    method: 'POST',
    data: { content },
  });
  return response.data;
}

export async function meetingMute(id: string, userId: string, minutes?: number) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/mute`,
    method: 'POST',
    data: minutes ? { userId, minutes } : { userId },
  });
  return response.data;
}

export async function meetingUnmute(id: string, userId: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/unmute`,
    method: 'POST',
    data: { userId },
  });
  return response.data;
}

export async function meetingKick(id: string, userId: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/kick`,
    method: 'POST',
    data: { userId },
  });
  return response.data;
}

export async function meetingUnkick(id: string, userId: string) {
  const response = await axiosForBackend({
    url: `/api/meeting/${id}/unkick`,
    method: 'POST',
    data: { userId },
  });
  return response.data;
}

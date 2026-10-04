import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

// 收入日统计：以实际确认到账为准，商城与咨询费分开；返回按天日期表（零元不入表）
export async function getIncomeStats() {
  const response = await axiosForBackend({
    url: '/api/stats/income',
    method: 'GET',
  });
  return response.data;
}

// 树下多层会员详情：直邀人数、团队人数、总收入（默认5层）
export async function getDownlineDetails(levels = 5) {
  const response = await axiosForBackend({
    url: `/api/stats/downline?levels=${levels}`,
    method: 'GET',
  });
  return response.data;
}

// 最近 N 天咨询费收入明细：付款人账号、级别、支付截图（默认3天）
export async function getRecentConsult(days = 3) {
  const response = await axiosForBackend({
    url: `/api/stats/consult-recent?days=${days}`,
    method: 'GET',
  });
  return response.data;
}

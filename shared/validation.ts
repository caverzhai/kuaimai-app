// 共享校验规则（前后端通用）

// 昵称规则：2-6个汉字 或 4-12个英文字母（必须是纯汉字或纯英文字母）
export const NICKNAME_HAN = /^[\u4e00-\u9fa5]{2,6}$/;
export const NICKNAME_ENG = /^[A-Za-z]{4,12}$/;

export const NICKNAME_RULE_HINT = '昵称需为2-6个汉字，或4-12个英文字母';

export function isValidNickname(nickname: unknown): boolean {
  if (typeof nickname !== 'string') return false;
  const n = nickname.trim();
  return NICKNAME_HAN.test(n) || NICKNAME_ENG.test(n);
}

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = 12;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET 环境变量未设置！使用临时密钥仅用于开发环境。');
}

const ACTIVE_SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-in-production';

export interface TokenPayload {
  userId: string;
  phone: string;
  level: string;
  isInvited: boolean;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACTIVE_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, ACTIVE_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * 兼容旧的SHA256密码哈希（用于迁移）
 * 旧用户首次登录成功后，自动升级为bcrypt哈希
 */
export function verifyLegacyPassword(password: string, hash: string): boolean {
  const crypto = require('crypto');
  const legacyHash = crypto
    .createHash('sha256')
    .update(password + (process.env.PASSWORD_SALT || 'kuaimai-salt'))
    .digest('hex');
  return legacyHash === hash;
}

export function generateOrderNo(prefix: string): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}${dateStr}${random}`;
}

export function generateInviteCode(length = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.verifyLegacyPassword = verifyLegacyPassword;
exports.generateOrderNo = generateOrderNo;
exports.generateInviteCode = generateInviteCode;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = 12;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET 环境变量未设置！使用临时密钥仅用于开发环境。');
}
const ACTIVE_SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-in-production';
function generateToken(payload) {
    return jwt.sign(payload, ACTIVE_SECRET, { expiresIn: '30d' });
}
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, ACTIVE_SECRET);
        return decoded;
    }
    catch {
        return null;
    }
}
async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}
async function verifyPassword(password, hash) {
    try {
        return await bcrypt.compare(password, hash);
    }
    catch {
        return false;
    }
}
function verifyLegacyPassword(password, hash) {
    const crypto = require('crypto');
    const legacyHash = crypto
        .createHash('sha256')
        .update(password + (process.env.PASSWORD_SALT || 'kuaimai-salt'))
        .digest('hex');
    return legacyHash === hash;
}
function generateOrderNo(prefix) {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${prefix}${dateStr}${random}`;
}
function generateInviteCode(length = 8) {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
        .toUpperCase();
}
//# sourceMappingURL=auth.util.js.map
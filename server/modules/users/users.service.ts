import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';

import type {
  LoginResponse,
  SupplementInviterDTO,
  UpdateProfileDTO,
  UserInfo,
  UserLoginDTO,
  UserRegisterDTO,
} from '@shared/api.interface';
import { LEVELS } from '@shared/api.interface';
import { users, teamRelations, inviteRecords, upgradeTasks, consultOrders, platformCollectionRecords, cloneNotifications } from '@server/database/schema';
import {
  generateInviteCode,
  generateToken,
  hashPassword,
  verifyPassword,
  verifyLegacyPassword,
} from '@server/common/utils/auth.util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import { isValidNickname, NICKNAME_RULE_HINT } from '@shared/validation';

type UserSelect = typeof users.$inferSelect;
type TeamRelationSelect = typeof teamRelations.$inferSelect;

/** 规范化邀请码：去空格、转大写；若扫到完整邀请链接则提取 inviteCode 参数 */
function normalizeInviteCode(raw: unknown): string {
  let code = String(raw ?? '').trim();
  if (code.includes('inviteCode=')) {
    const m = code.match(/inviteCode=([^&]+)/i);
    if (m && m[1]) code = m[1];
  }
  // 去掉可能残留的 URL 尾部斜杠/空白
  return code.replace(/[\s/]+$/g, '').trim().toUpperCase();
}

const MAX_DIRECT_CHILDREN = 3;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly ocrService: OcrService,
  ) {}

  // ── Registration ──────────────────────────────────────────────

  async register(dto: UserRegisterDTO): Promise<LoginResponse> {
    // 0. 校验手机号格式（11位数字）
    if (!/^1\d{10}$/.test(dto.phone)) {
      throw new BadRequestException('手机号格式不正确，必须是11位数字');
    }

    // 1. 校验手机号唯一性
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('手机号已注册');
    }

    // 1.4 校验昵称格式（2-6汉字 或 4-12英文字母）
    if (!isValidNickname(dto.nickname)) {
      throw new BadRequestException(NICKNAME_RULE_HINT);
    }

    // 1.5 校验昵称唯一性
    const existingNickname = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nickname, dto.nickname))
      .limit(1);
    if (existingNickname.length > 0) {
      throw new ConflictException('昵称已被使用，请换一个昵称');
    }

    // 2. 查找邀请人（如果有邀请码）
    let inviter: UserSelect | null = null;
    let normalizedInviteCode: string | null = null;
    if (dto.inviteCode) {
      normalizedInviteCode = normalizeInviteCode(dto.inviteCode);
      const inviterRows = await this.db
        .select()
        .from(users)
        .where(eq(users.inviteCode, normalizedInviteCode))
        .limit(1);
      if (inviterRows.length === 0) {
        throw new BadRequestException('邀请码无效，请核对后重新输入或扫码');
      }
      inviter = inviterRows[0];
    }

    const normalizedPassword = String(dto.password ?? '').trim();
    if (normalizedPassword.length < 6) {
      throw new BadRequestException('密码长度至少6位');
    }
    const hashedPassword = await hashPassword(normalizedPassword);
    const inviteCode = generateInviteCode(8);

    // 3. 事务：创建用户 + 团队关系 + 更新计数
    const result = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          phone: dto.phone,
          nickname: dto.nickname,
          password: hashedPassword,
          avatarUrl: dto.avatarUrl,
          level: LEVELS.JUNIOR,
          isInvited: !!inviter,
          inviterId: inviter?.id,
          inviteCode,
          securityQuestion: dto.securityQuestion || null,
          securityAnswer: dto.securityAnswer ? dto.securityAnswer.trim() : null,
        })
        .returning();

      if (inviter) {
        // 注册时只记录直推关系，不立即滑落进团队树
        // 完成4级升级任务后才调用 assignUserToTeamTree 滑落进入
        // 邀请人 direct_invite_count 在"被邀请者升为4级"时才 +1（见 upgrade.service），
        // 此处不再提前 +1，避免 junior 直推也被计入"有效直推"导致虚高。

        // 写入 invite_records
        await tx.insert(inviteRecords).values({
          inviterId: inviter.id,
          inviteeId: newUser.id,
          inviteCode: normalizedInviteCode ?? inviteCode,
        });

        // 重新查询完整用户信息
        const [updatedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, newUser.id))
          .limit(1);
        return updatedUser;
      }

      return newUser;
    });

    const token = this.makeToken(result);
    const userInfo = this.toUserInfo(result);
    if (inviter) {
      userInfo.inviterNickname = inviter.nickname;
      userInfo.inviterPhone = inviter.phone;
    }
    return { token, user: userInfo };
  }

  // ── Login ─────────────────────────────────────────────────────

  async login(dto: UserLoginDTO): Promise<LoginResponse> {
    // —— 登录诊断（临时，用于排查 APP 登录问题，定位后移除）——
    const diag = new Logger('LoginDiag');
    const rawPhone = dto?.phone;
    const rawPwd = dto?.password;
    const phoneNorm = String(rawPhone ?? '').trim();
    const pwdStr = String(rawPwd ?? '');
    const pwdTrim = pwdStr.trim();
    diag.log(
      `login phone=${JSON.stringify(rawPhone)} phoneNorm=${JSON.stringify(phoneNorm)} ` +
      `pwdLen=${pwdStr.length} pwdTrimLen=${pwdTrim.length} ` +
      `hasNonAscii=${/[^\x20-\x7e]/.test(pwdStr)} edgeSpace=${pwdStr !== pwdTrim} ` +
      `dtoKeys=${JSON.stringify(Object.keys(dto || {}))}`,
    );

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, phoneNorm))
      .limit(1);

    if (userRows.length === 0) {
      diag.warn(`login 用户不存在 phoneNorm=${JSON.stringify(phoneNorm)}`);
      throw new UnauthorizedException('手机号或密码不正确。为了账号安全，请联系管理员重置新密码');
    }

    const user = userRows[0];
    // 先尝试 bcrypt 验证（原始密码）
    let passwordValid = await verifyPassword(pwdStr, user.password);
    // 首尾空格兼容（部分手机输入法会自动追加空格）
    if (!passwordValid && pwdStr !== pwdTrim) {
      passwordValid = await verifyPassword(pwdTrim, user.password);
    }
    // 仍失败则尝试旧的 SHA256 验证（兼容老用户，原始 + 去空格）
    if (!passwordValid && verifyLegacyPassword(pwdStr, user.password)) {
      passwordValid = true;
    }
    if (!passwordValid && pwdStr !== pwdTrim && verifyLegacyPassword(pwdTrim, user.password)) {
      passwordValid = true;
    }
    if (passwordValid) {
      // 验证成功后统一升级为 bcrypt 哈希
      try {
        const rawOk = await verifyPassword(pwdStr, user.password);
        const finalPwd = rawOk ? pwdStr : pwdTrim;
        const newHash = await hashPassword(finalPwd);
        await this.db.update(users).set({ password: newHash }).where(eq(users.id, user.id));
      } catch {}
    }
    if (!passwordValid) {
      diag.warn(`login 密码不匹配 phoneNorm=${JSON.stringify(phoneNorm)} pwdLen=${pwdStr.length}`);
      throw new UnauthorizedException('手机号或密码不正确。为了账号安全，请联系管理员重置新密码');
    }
    diag.log(`login 成功 phoneNorm=${JSON.stringify(phoneNorm)}`);

    // 账号已被四星考核淘汰：禁止登录
    if (user.assessmentStatus === 'eliminated') {
      diag.warn(`login 账号已淘汰，禁止登录 phoneNorm=${JSON.stringify(phoneNorm)}`);
      throw new ForbiddenException(
        '该账号因60天内未完成四星考核已失效，可用新手机号重新注册',
      );
    }

    const token = this.makeToken(user);
    const userInfo = this.toUserInfo(user);
    // 关联查询邀请人信息
    if (user.inviterId) {
      const inviterRows = await this.db
        .select({ nickname: users.nickname, phone: users.phone })
        .from(users)
        .where(eq(users.id, user.inviterId))
        .limit(1);
      if (inviterRows.length > 0) {
        userInfo.inviterNickname = inviterRows[0].nickname;
        userInfo.inviterPhone = inviterRows[0].phone;
      }
    }
    return { token, user: userInfo };
  }

  // ── Current user ──────────────────────────────────────────────

    // ── Security question ──────────────────────────────────────────

  async getSecurityQuestion(phone: string): Promise<{ question: string | null }> {
    const userRows = await this.db
      .select({ securityQuestion: users.securityQuestion })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('手机号未注册');
    }
    return { question: userRows[0].securityQuestion };
  }

  async resetPasswordBySecurity(body: { phone: string; securityAnswer: string; newPassword: string }): Promise<{ success: boolean }> {
    const { phone, securityAnswer } = body;
    const newPassword = String(body.newPassword ?? '').trim();
    if (!phone || !securityAnswer || !newPassword) {
      throw new BadRequestException('参数不完整');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('新密码长度至少6位');
    }

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('手机号未注册');
    }
    const user = userRows[0];

    if (!user.securityQuestion || !user.securityAnswer) {
      throw new BadRequestException('该账号未设置安全问题，请联系管理员重置密码');
    }

    if (user.securityAnswer !== securityAnswer.trim()) {
      throw new BadRequestException('安全问题答案错误');
    }

    const newHash = await hashPassword(newPassword);
    await this.db
      .update(users)
      .set({ password: newHash })
      .where(eq(users.id, user.id));

    this.logger.log(`用户通过安全问题重置密码: userId=${user.id}, phone=${phone}`);
    return { success: true };
  }

  /**
   * 登录态修改密码：凭旧密码校验后设置新密码
   */
  async changePassword(
    userId: string,
    body: { oldPassword: string; newPassword: string },
  ): Promise<{ success: boolean }> {
    const oldPwd = String(body.oldPassword ?? '');
    const newPwd = String(body.newPassword ?? '').trim();

    if (!oldPwd || !newPwd) {
      throw new BadRequestException('请填写旧密码和新密码');
    }
    if (newPwd.length < 6) {
      throw new BadRequestException('新密码长度至少6位');
    }

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const user = userRows[0];

    // 校验旧密码（bcrypt + 去空格 + legacy，与登录逻辑一致）
    let oldValid = await verifyPassword(oldPwd, user.password);
    const oldTrim = oldPwd.trim();
    if (!oldValid && oldPwd !== oldTrim) {
      oldValid = await verifyPassword(oldTrim, user.password);
    }
    if (!oldValid && verifyLegacyPassword(oldPwd, user.password)) {
      oldValid = true;
    }
    if (!oldValid && oldPwd !== oldTrim && verifyLegacyPassword(oldTrim, user.password)) {
      oldValid = true;
    }

    if (!oldValid) {
      throw new BadRequestException('旧密码不正确，请重新输入；若忘记旧密码，请联系管理员重置');
    }

    // 新密码不能与旧密码相同
    if (newPwd === oldPwd || newPwd === oldTrim) {
      throw new BadRequestException('新密码不能与旧密码相同，请设置不同的新密码');
    }

    const newHash = await hashPassword(newPwd);
    await this.db
      .update(users)
      .set({ password: newHash })
      .where(eq(users.id, user.id));

    this.logger.log(`用户登录态修改密码成功: userId=${user.id}, phone=${user.phone}`);
    return { success: true };
  }

  async getCurrentUser(userId: string): Promise<UserInfo> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];

    const userInfo = this.toUserInfo(user);

    // 关联查询邀请人信息
    if (user.inviterId) {
      const inviterRows = await this.db
        .select({ nickname: users.nickname, phone: users.phone })
        .from(users)
        .where(eq(users.id, user.inviterId))
        .limit(1);
      if (inviterRows.length > 0) {
        userInfo.inviterNickname = inviterRows[0].nickname;
        userInfo.inviterPhone = inviterRows[0].phone;
      }
    }

    userInfo.directInviteCount = await this.countEffectiveDirect(userId);
    return userInfo;
  }

  // 获取用户关系树（上级+下级）
  async getRelationTree(userId: string): Promise<{
    // 上级关系
    directInviter: { id: string; nickname: string; phone: string; level: string } | null;
    directParent: { id: string; nickname: string; phone: string; level: string } | null;
    // 下级关系（可能有多个）
    directChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
    secondGenerationChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
    thirdGenerationChildren: Array<{ id: string; nickname: string; phone: string; level: string }>;
    descendantGenerations: Array<{ generation: number; count: number; users: Array<{ id: string; nickname: string; phone: string; level: string }> }>;
    pendingDirectInvites: Array<{ id: string; nickname: string; phone: string; level: string }>;
  }> {
    const userRows = await this.db
      .select({ inviterId: users.inviterId, parentId: users.parentId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];
    const result = {
      directInviter: null,
      directParent: null,
      directChildren: [],
      secondGenerationChildren: [],
      thirdGenerationChildren: [],
      descendantGenerations: [],
      pendingDirectInvites: [],
    };

    // 辅助函数：根据ID获取用户简要信息
    const getUserBrief = async (id: string | null) => {
      if (!id) return null;
      const rows = await this.db
        .select({ id: users.id, nickname: users.nickname, phone: users.phone, level: users.level })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return rows.length > 0 ? rows[0] : null;
    };

    // 辅助函数：根据parentId获取所有下级用户
    const getChildrenByParentId = async (parentId: string) => {
      const rows = await this.db
        .select({ id: users.id, nickname: users.nickname, phone: users.phone, level: users.level })
        .from(users)
        .where(eq(users.parentId, parentId));
      return rows;
    };

    // ===== 上级关系 =====
    // a. 我的直接邀请人
    result.directInviter = await getUserBrief(user.inviterId);

    // b. 我的直接上级咨询师（上一代）
    result.directParent = await getUserBrief(user.parentId);

    // ===== 下级关系（递归查最多15代；第1-5代显示姓名，第6代及以后前端只显示人数）=====
    const descendantGenerations: Array<{ generation: number; count: number; users: Array<{ id: string; nickname: string; phone: string; level: string }> }> = [];
    let currentParentIds: string[] = [userId];
    for (let gen = 1; gen <= 15; gen++) {
      if (currentParentIds.length === 0) break;
      const genUsers: Array<{ id: string; nickname: string; phone: string; level: string }> = [];
      const nextParentIds: string[] = [];
      for (const pid of currentParentIds) {
        const children = await getChildrenByParentId(pid);
        genUsers.push(...children);
        nextParentIds.push(...children.map(c => c.id));
      }
      descendantGenerations.push({ generation: gen, count: genUsers.length, users: genUsers });
      currentParentIds = nextParentIds;
    }
    result.descendantGenerations = descendantGenerations;
    // 兼容旧字段
    result.directChildren = descendantGenerations[0]?.users || [];
    result.secondGenerationChildren = descendantGenerations[1]?.users || [];
    result.thirdGenerationChildren = descendantGenerations[2]?.users || [];

    // ===== 直推区待定（已邀请但未完成4级任务，未进入团队树） =====
    const allDirectInvitees = await this.db
      .select({ id: users.id, nickname: users.nickname, phone: users.phone, level: users.level })
      .from(users)
      .where(eq(users.inviterId, userId));
    // 过滤出不在团队树中的（未滑落）
    const inTeamTree = new Set(
      (await this.db.select({ userId: teamRelations.userId }).from(teamRelations).where(eq(teamRelations.inviterId, userId)))
        .map(r => r.userId)
    );
    result.pendingDirectInvites = allDirectInvitees.filter(u => !inTeamTree.has(u.id));

    return result;
  }

  // ── 四星60天考核 ─────────────────────────────────────────────

  // 四星及以上级别（有效用户）
  private static readonly HIGH_LEVELS = [
    LEVELS.LEVEL_4, LEVELS.LEVEL_5, LEVELS.LEVEL_6,
    LEVELS.LEVEL_7, LEVELS.LEVEL_8, LEVELS.LEVEL_9,
  ];

  /**
   * 统计用户直推的"有效四星咨询师"人数
   * 有效 = 直推关系（inviterId）且级别已达到四星及以上
   */
  async getValidFourStarInviteCount(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.inviterId, userId),
        inArray(users.level, UsersService.HIGH_LEVELS),
        ne(users.assessmentStatus, 'eliminated'),
      ));
    return rows.length;
  }

  /**
   * 获取用户四星考核状态信息（供前端展示倒计时、进度、代收金额）
   */
  async getAssessmentInfo(userId: string) {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const user = userRows[0];

    // 非四星考核对象
    if (!user.fourStarAt || user.assessmentStatus === 'none') {
      return {
        status: 'none',
        targetCount: 3,
        validFourStarCount: 0,
      };
    }

    const start = new Date(user.fourStarAt).getTime();
    const day30Deadline = new Date(start + 30 * 24 * 3600 * 1000);
    const day60Deadline = new Date(start + 60 * 24 * 3600 * 1000);
    const now = Date.now();
    const daysRemaining = Math.max(
      0,
      Math.ceil((day60Deadline.getTime() - now) / (24 * 3600 * 1000)),
    );
    const validFourStarCount = await this.getValidFourStarInviteCount(userId);

    return {
      status: user.assessmentStatus, // collecting / passed / eliminated
      fourStarAt: new Date(user.fourStarAt).toISOString(),
      day30Deadline: day30Deadline.toISOString(),
      day60Deadline: day60Deadline.toISOString(),
      daysRemaining,
      targetCount: 3,
      validFourStarCount,
      platformCollectedAmount: String(user.platformCollectedAmount),
      refundRate: user.refundRate ?? null,
      refundedAmount: String(user.refundedAmount),
      refundStatus: user.refundStatus,
    };
  }

  /**
   * 定时考核处理（每分钟调用）：
   * 1. 考核中用户达标 → 确定返还比例，标记 passed，等待平台打款
   * 2. 满60天未达标 → 淘汰，没收代收，触发顶替搜索
   * 3. 重查空置位置是否出现合格顶替者
   */
  async processAssessmentCron(): Promise<{
    passed: Array<{ userId: string; rate: number; refundAmount: number }>;
    eliminated: string[];
    replacementsFound: string[];
  }> {
    // 考核入口检查：升级满7天且累计咨询费收入超900元的正式四星，启动考核（平台代收）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const assessmentCandidates = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.assessmentStatus, 'none'),
        isNotNull(users.fourStarAt),
        lte(users.fourStarAt, sevenDaysAgo),
      ));
    for (const u of assessmentCandidates) {
      const income = Number(u.totalConsultIncome) || 0;
      if (income > 900) {
        await this.db
          .update(users)
          .set({ assessmentStatus: 'collecting' })
          .where(eq(users.id, u.id));
        this.logger.log(`四星考核入口触发: userId=${u.id}, 累计收入=${income}, 启动平台代收`);
      }
    }

    const collecting = await this.db
      .select()
      .from(users)
      .where(eq(users.assessmentStatus, 'collecting'));

    const passedList: Array<{ userId: string; rate: number; refundAmount: number }> = [];
    const eliminatedList: string[] = [];

    for (const u of collecting) {
      if (!u.fourStarAt) continue;
      const validCount = await this.getValidFourStarInviteCount(u.id);
      const start = new Date(u.fourStarAt).getTime();
      const elapsedDays = (Date.now() - start) / (24 * 3600 * 1000);

      if (validCount >= 3) {
        // 达标：30天内100%，31-60天50%
        const rate = elapsedDays <= 30 ? 100 : 50;
        const collected = Number(u.platformCollectedAmount) || 0;
        const refundAmount = (collected * rate) / 100;
        await this.db
          .update(users)
          .set({
            assessmentStatus: 'passed',
            refundRate: rate,
            refundedAmount: refundAmount.toFixed(2),
            refundStatus: collected > 0 ? 'pending' : 'confirmed',
          })
          .where(eq(users.id, u.id));
        this.logger.log(
          `四星考核达标: userId=${u.id}, 用时${elapsedDays.toFixed(1)}天, 返还比例=${rate}%, 返还金额=${refundAmount}`,
        );
        passedList.push({ userId: u.id, rate, refundAmount });
      } else if (elapsedDays >= 60) {
        // 淘汰
        await this.db
          .update(users)
          .set({ assessmentStatus: 'eliminated' })
          .where(eq(users.id, u.id));
        // 没收未返还的代收金额
        await this.db
          .update(platformCollectionRecords)
          .set({ refundStatus: 'forfeited' })
          .where(eq(platformCollectionRecords.consultantId, u.id));
        this.logger.warn(`四星考核未达标，账号淘汰: userId=${u.id}`);
        eliminatedList.push(u.id);
        // 触发顶替搜索
        await this.findAndNotifyReplacement(u.id);
      }
    }

    // 重查空置/待处理的淘汰位置
    const replacementsFound = await this.recheckReplacements();

    return { passed: passedList, eliminated: eliminatedList, replacementsFound };
  }

  /**
   * 重查所有淘汰位置：
   * - 已完成顶替（done）的跳过
   * - 已通知待提供手机号（pending_phone）的跳过
   * - 其余重新搜索顶替者
   */
  async recheckReplacements(): Promise<string[]> {
    const eliminated = await this.db
      .select()
      .from(users)
      .where(eq(users.assessmentStatus, 'eliminated'));

    const found: string[] = [];
    for (const a of eliminated) {
      const existing = await this.db
        .select({ id: cloneNotifications.id, status: cloneNotifications.status })
        .from(cloneNotifications)
        .where(eq(cloneNotifications.eliminatedUserId, a.id));
      const hasDone = existing.some((n) => n.status === 'done');
      const hasPending = existing.some((n) => n.status === 'pending_phone');
      if (hasDone || hasPending) continue;
      const b = await this.findAndNotifyReplacement(a.id);
      if (b) found.push(b);
    }
    return found;
  }

  /**
   * BFS 从被淘汰者团队树中寻找顶替者：
   * 关系最近优先（浅层、从左到右），找第一个直推有效四星满10人的人
   * 找到则创建分身资格通知；找不到返回 null（位置空置，等待重查）
   */
  async findAndNotifyReplacement(eliminatedUserId: string): Promise<string | null> {
    const queue: string[] = [eliminatedUserId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const children = await this.db
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.parentId, current));
      const sorted = [...children].sort((a, b) => a.position - b.position);

      for (const child of sorted) {
        const count = await this.getValidFourStarInviteCount(child.userId);
        if (count >= 10) {
          // 检查是否已存在有效通知，避免重复
          const existingNotif = await this.db
            .select({ id: cloneNotifications.id })
            .from(cloneNotifications)
            .where(and(
              eq(cloneNotifications.eliminatedUserId, eliminatedUserId),
              inArray(cloneNotifications.status, ['pending_phone', 'done']),
            ));
          if (existingNotif.length === 0) {
            await this.db.insert(cloneNotifications).values({
              eligibleUserId: child.userId,
              eliminatedUserId,
              status: 'pending_phone',
            });
            await this.db
              .update(users)
              .set({ cloneEligible: true })
              .where(eq(users.id, child.userId));
            this.logger.log(
              `找到分身顶替者: 淘汰者=${eliminatedUserId}, 顶替者=${child.userId}`,
            );
          }
          return child.userId;
        }
        queue.push(child.userId);
      }
    }
    return null;
  }

  /**
   * 顶替者 B 提供新手机号，系统创建分身号并完成团队迁移：
   * - 分身号复制 B 的实名/收款码/密码/当前级别
   * - 分身号占据被淘汰者 A 的位置，继承 A 全部团队
   */
  async submitClonePhone(
    currentUserId: string,
    newPhone: string,
  ): Promise<{ cloneUserId: string; newPhone: string }> {
    const phone = String(newPhone ?? '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      throw new BadRequestException('手机号格式不正确，必须是11位数字');
    }

    // 查找本人待处理的分身资格
    const notifRows = await this.db
      .select()
      .from(cloneNotifications)
      .where(and(
        eq(cloneNotifications.eligibleUserId, currentUserId),
        eq(cloneNotifications.status, 'pending_phone'),
      ))
      .limit(1);
    if (notifRows.length === 0) {
      throw new BadRequestException('没有待处理的分身资格');
    }
    const notif = notifRows[0];

    // 新手机号唯一性
    const existPhone = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (existPhone.length > 0) {
      throw new ConflictException('该手机号已注册，请换一个');
    }

    // 原主 B 和被淘汰者 A
    const bRows = await this.db.select().from(users).where(eq(users.id, currentUserId)).limit(1);
    const b = bRows[0];
    const aRows = await this.db.select().from(users).where(eq(users.id, notif.eliminatedUserId)).limit(1);
    const a = aRows[0];
    const aRelRows = await this.db
      .select()
      .from(teamRelations)
      .where(eq(teamRelations.userId, a.id))
      .limit(1);
    if (aRelRows.length === 0) {
      throw new BadRequestException('被淘汰者团队关系异常，无法顶替');
    }
    const aRel = aRelRows[0];

    const newInviteCode = generateInviteCode(8);
    const cloneNickname = b.nickname + '分身' + phone.slice(-4);

    const result = await this.db.transaction(async (tx) => {
      // 1. 创建分身号 C
      const [c] = await tx
        .insert(users)
        .values({
          phone,
          nickname: cloneNickname,
          password: b.password, // 密码一致（已哈希）
          avatarUrl: b.avatarUrl,
          gender: b.gender,
          age: b.age,
          level: b.level, // 复制当前级别，以后各自升级
          isInvited: a.isInvited,
          inviterId: a.inviterId,
          inviteCode: newInviteCode,
          // 实名信息直接复制
          realName: b.realName,
          idCardNumber: b.idCardNumber,
          idCardFrontUrl: b.idCardFrontUrl,
          idCardBackUrl: b.idCardBackUrl,
          address: b.address,
          wechatQrcodeUrl: b.wechatQrcodeUrl,
          alipayQrcodeUrl: b.alipayQrcodeUrl,
          companyQrcodeUrl: b.companyQrcodeUrl,
          companyAuditStatus: b.companyAuditStatus,
          businessLicenseUrl: b.businessLicenseUrl,
          isSeller: b.isSeller,
          sellerStatus: b.sellerStatus,
          // 继承 A 的团队位置与计数
          parentId: a.parentId,
          treeLevel: a.treeLevel,
          directInviteCount: a.directInviteCount,
          teamTotalCount: a.teamTotalCount,
          // 分身标记
          isClone: true,
          cloneOfId: b.id,
          replacementForId: a.id,
          // 分身号视为已达标，永久正常收款，不再被考核
          assessmentStatus: 'passed',
          fourStarAt: new Date(),
          refundStatus: 'none',
        })
        .returning();

      // 2. 创建 C 的团队关系（path 先复制 A，稍后统一替换）
      await tx.insert(teamRelations).values({
        userId: c.id,
        parentId: aRel.parentId,
        inviterId: aRel.inviterId,
        treeLevel: aRel.treeLevel,
        path: aRel.path,
        position: aRel.position,
      });

      // 3. 物化路径统一替换 A -> C（C 新记录 + A 全部下线）
      const aToken = ',' + a.id + ',';
      const cToken = ',' + c.id + ',';
      const likePattern = '%' + aToken + '%';
      await tx.execute(
        sql`UPDATE team_relations SET path = REPLACE(path, ${aToken}, ${cToken}) WHERE path LIKE ${likePattern}`,
      );

      // 4. A 的团队直接子女 parentId 改为 C
      await tx
        .update(teamRelations)
        .set({ parentId: c.id })
        .where(eq(teamRelations.parentId, a.id));

      // 5. A 的直推用户 inviterId 改为 C（A 原来推的人全部归分身号）
      await tx
        .update(users)
        .set({ inviterId: c.id })
        .where(eq(users.inviterId, a.id));

      // 6. 删除 A 的团队关系（A 已不在树中，users 记录保留为 eliminated）
      await tx.delete(teamRelations).where(eq(teamRelations.userId, a.id));

      // 7. 更新通知为已完成
      await tx
        .update(cloneNotifications)
        .set({ status: 'done', cloneUserId: c.id, newPhone: phone, updatedAt: new Date() })
        .where(eq(cloneNotifications.id, notif.id));

      // 8. 若 B 已无其他待处理分身通知，则关闭 cloneEligible（仍有通知则保留，可再建分身）
      const remainNotifs = await tx
        .select({ id: cloneNotifications.id })
        .from(cloneNotifications)
        .where(
          and(
            eq(cloneNotifications.eligibleUserId, b.id),
            eq(cloneNotifications.status, 'pending_phone'),
          ),
        );
      if (remainNotifs.length === 0) {
        await tx
          .update(users)
          .set({ cloneEligible: false })
          .where(eq(users.id, b.id));
      }

      return c;
    });

    this.logger.log(
      `分身号创建完成: 原主=${currentUserId}, 分身号=${result.id}, 顶替=${a.id}, 手机=${phone}`,
    );
    return { cloneUserId: result.id, newPhone: phone };
  }

  // ── Update profile ────────────────────────────────────────────

  async updateProfile(
    userId: string,
    dto: UpdateProfileDTO,
  ): Promise<UserInfo> {
    // 取当前用户旧记录（用于判断身份证图是否变更）
    const currentRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (currentRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const currentUser = currentRows[0];

    const patch: Partial<typeof users.$inferInsert> = {};

    if (dto.nickname !== undefined) {
      if (!isValidNickname(dto.nickname)) {
        throw new BadRequestException(NICKNAME_RULE_HINT);
      }
      patch.nickname = dto.nickname.trim();
    }
    if (dto.avatarUrl !== undefined) patch.avatarUrl = dto.avatarUrl;
    if (dto.gender !== undefined) patch.gender = dto.gender;
    if (dto.age !== undefined) patch.age = dto.age;
    if (dto.receiveAddress !== undefined) patch.receiveAddress = dto.receiveAddress;
    if (dto.receivePhone !== undefined) patch.receivePhone = dto.receivePhone;
    if (dto.industry !== undefined) patch.industry = dto.industry;
    if (dto.qualification !== undefined) patch.qualification = dto.qualification;
    if (dto.serviceStandard !== undefined) patch.serviceStandard = dto.serviceStandard;
    if (dto.wechatQrcodeUrl !== undefined) patch.wechatQrcodeUrl = dto.wechatQrcodeUrl;
    if (dto.alipayQrcodeUrl !== undefined) patch.alipayQrcodeUrl = dto.alipayQrcodeUrl;
    if (dto.companyQrcodeUrl !== undefined) patch.companyQrcodeUrl = dto.companyQrcodeUrl;
    if (dto.businessLicenseUrl !== undefined) patch.businessLicenseUrl = dto.businessLicenseUrl;
    if (dto.idCardFrontUrl !== undefined) patch.idCardFrontUrl = dto.idCardFrontUrl;
    if (dto.idCardBackUrl !== undefined) patch.idCardBackUrl = dto.idCardBackUrl;
    if (dto.realName !== undefined) patch.realName = dto.realName;
    if (dto.wechatId !== undefined) patch.wechatId = dto.wechatId;
    if (dto.address !== undefined) patch.address = dto.address;

    // 身份证号处理：格式校验、唯一性检查、自动判断性别
    if (dto.idCardNumber !== undefined && dto.idCardNumber.trim() !== '') {
      const idCard = dto.idCardNumber.trim().toUpperCase();
      // 身份证号格式校验（18位，最后一位可以是X）
      if (!/^\d{17}[\dX]$/.test(idCard)) {
        throw new BadRequestException('身份证号格式不正确，必须是18位数字');
      }
      // 唯一性检查（排除当前用户；被淘汰账号的身份证允许重新认证）
      const existing = await this.db
        .select({ id: users.id, assessmentStatus: users.assessmentStatus })
        .from(users)
        .where(eq(users.idCardNumber, idCard))
        .limit(1);
      if (
        existing.length > 0 &&
        existing[0].id !== userId &&
        existing[0].assessmentStatus !== 'eliminated'
      ) {
        throw new ConflictException('该身份证号已被其他用户使用');
      }
      patch.idCardNumber = idCard;
      // 根据身份证号自动判断性别（第17位，奇数为男，偶数为女）
      const genderDigit = parseInt(idCard.charAt(16), 10);
      if (!isNaN(genderDigit)) {
        patch.gender = genderDigit % 2 === 1 ? '男' : '女';
      }
    }

    // 身份证正面图：直接保存照片，不再联网OCR识别
    if (
      dto.idCardFrontUrl !== undefined &&
      dto.idCardFrontUrl !== (currentUser.idCardFrontUrl ?? '')
    ) {
      patch.idCardFrontUrl = dto.idCardFrontUrl;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    // 提交了企业相关资料，设置为待审核
    if (dto.companyQrcodeUrl !== undefined || dto.businessLicenseUrl !== undefined) {
      patch.companyAuditStatus = 'pending';
    }

    const updated = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.toUserInfo(updated[0]);
  }

  // ── Supplement inviter ────────────────────────────────────────

  async supplementInviter(
    userId: string,
    dto: SupplementInviterDTO,
  ): Promise<UserInfo> {
    // 查找当前用户
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }
    const user = userRows[0];

    if (user.isInvited) {
      throw new BadRequestException('您已经有邀请人，无需补充');
    }

    // 查找邀请人
    const normalizedCode = normalizeInviteCode(dto.inviteCode);
    const inviterRows = await this.db
      .select()
      .from(users)
      .where(eq(users.inviteCode, normalizedCode))
      .limit(1);
    if (inviterRows.length === 0) {
      throw new BadRequestException('邀请码无效，请核对后重新输入或扫码');
    }
    const inviter = inviterRows[0];

    if (inviter.id === userId) {
      throw new BadRequestException('不能使用自己的邀请码');
    }

    const result = await this.db.transaction(async (tx) => {
      // 更新用户信息（只记直推关系，不立即滑落）
      await tx
        .update(users)
        .set({
          isInvited: true,
          inviterId: inviter.id,
        })
        .where(eq(users.id, user.id));

      // 删除已生成的升级任务（因为之前没有邀请人，targetId可能是管理员）
      await tx.delete(upgradeTasks).where(eq(upgradeTasks.userId, user.id));

      // 同时清理"补充邀请人之前"生成的、收款人兜底为管理员的【未付款】咨询订单；
      // 否则旧的管理员收款单会残留，用户重新下单还会因同一任务冲突，无法付给正确的直推人。
      // 已付款/审核中的订单不在此删除，避免资金问题，需人工核对处理。
      const SUPP_ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';
      await tx
        .delete(consultOrders)
        .where(and(
          eq(consultOrders.studentId, user.id),
          eq(consultOrders.consultantId, SUPP_ADMIN_ID),
          eq(consultOrders.status, 'pending_payment'),
        ));

      // 邀请人 direct_invite_count +1：仅当该用户已是4级及以上（即已是有效直推）。
      // 若是 junior，则不提前 +1，等其后续升4级时由 upgrade.service 统一 +1，
      // 避免 junior 直推把邀请人的"有效直推"数抬高。
      if (this.getLevelLayer(user.level) >= 4) {
        await tx
          .update(users)
          .set({ directInviteCount: sql`${users.directInviteCount} + 1` })
          .where(eq(users.id, inviter.id));
      }

      // 写入 invite_records
      await tx.insert(inviteRecords).values({
        inviterId: inviter.id,
        inviteeId: user.id,
        inviteCode: normalizedCode,
      });

      const [updatedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return updatedUser;
    });

    // 补充邀请人后，如果用户已经是4级以上，立即滑落进入团队树
    const userLevel = result.level;
    const levelLayer = this.getLevelLayer(userLevel);
    if (levelLayer >= 4) {
      await this.assignUserToTeamTree(user.id, inviter.id);
    }

    return this.toUserInfo(result);
  }

  // ── Invite code (get or generate) ─────────────────────────────

  async getOrGenerateInviteCode(userId: string): Promise<{ inviteCode: string }> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = userRows[0];
    const levelLayer = this.getLevelLayer(user.level);
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';

    // 管理员（零号线）和4级及以上咨询师可以生成邀请码
    if (levelLayer < 4 && user.id !== ADMIN_ID) {
      throw new BadRequestException('仅4级及以上咨询师可生成邀请码');
    }

    if (user.inviteCode) {
      return { inviteCode: user.inviteCode };
    }

    // 生成并保存邀请码（带冲突重试）
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      try {
        const updated = await this.db
          .update(users)
          .set({ inviteCode })
          .where(eq(users.id, userId))
          .returning({ inviteCode: users.inviteCode });
        if (updated.length > 0 && updated[0].inviteCode) {
          return { inviteCode: updated[0].inviteCode };
        }
        break;
      } catch {
        // 可能是唯一约束冲突，换一个重试
        inviteCode = generateInviteCode();
        attempts += 1;
      }
    }

    throw new ConflictException('生成邀请码失败，请稍后重试');
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * BFS 团队树滑落：从邀请人开始，逐层找到第一个直接下级不足 3 人的节点
   */
  private async findParentForSliding(
    tx: PostgresJsDatabase,
    inviterId: string,
  ): Promise<{ parentId: string; parentRelation: TeamRelationSelect | null }> {
    const queue: string[] = [inviterId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = await tx
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.parentId, currentId));

      if (children.length < MAX_DIRECT_CHILDREN) {
        // 查找当前节点的 team_relations 记录（用于 path 和 treeLevel）
        const relationRows = await tx
          .select()
          .from(teamRelations)
          .where(eq(teamRelations.userId, currentId))
          .limit(1);
        return {
          parentId: currentId,
          parentRelation: relationRows[0] ?? null,
        };
      }

      // 按 position 排序加入队列，保证从左到右滑落
      const sortedChildren = [...children].sort(
        (a: TeamRelationSelect, b: TeamRelationSelect) => a.position - b.position,
      );
      for (const child of sortedChildren) {
        queue.push(child.userId);
      }
    }

    // 理论上不会到这里（3 叉树指数增长，队列很快会遇到空位）
    this.logger.warn(`BFS sliding fallback to inviter: ${inviterId}`);
    return { parentId: inviterId, parentRelation: null };
  }

  /**
   * 将用户分配到团队树（完成4级任务后调用）
   * 注册时不占团队树位置，只有完成4级升级任务后才滑落进入
   */
  async assignUserToTeamTree(userId: string, inviterId: string): Promise<{ parentId: string; treeLevel: number } | null> {
    const existing = await this.db
      .select({ id: teamRelations.id })
      .from(teamRelations)
      .where(eq(teamRelations.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      this.logger.log('用户已在团队树中，跳过滑落: userId=' + userId);
      return null;
    }
    const inviterRows = await this.db.select().from(users).where(eq(users.id, inviterId)).limit(1);
    if (inviterRows.length === 0) {
      this.logger.warn('邀请人不存在，无法滑落: userId=' + userId);
      return null;
    }
    const result = await this.db.transaction(async (tx) => {
      const { parentId, parentRelation } = await this.findParentForSliding(tx, inviterId);
      const treeLevel = parentRelation ? parentRelation.treeLevel + 1 : 1;
      const basePath = parentRelation ? parentRelation.path : ',' + inviterId + ',';
      const path = basePath + userId + ',';
      const childCount = await tx.select({ count: sql<number>`count(*)` }).from(teamRelations).where(eq(teamRelations.parentId, parentId));
      const position = Number(childCount[0]?.count ?? 0);
      await tx.insert(teamRelations).values({ userId, parentId, inviterId, treeLevel, path, position });
      await tx.update(users).set({ parentId, treeLevel }).where(eq(users.id, userId));
      const ancestorIds = path.split(',').filter((s) => s.length > 0 && s !== userId);
      if (ancestorIds.length > 0) {
        await tx.update(users).set({ teamTotalCount: sql`${users.teamTotalCount} + 1` }).where(sql`${users.id} = ANY(ARRAY[${sql.join(ancestorIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`);
      }
      return { parentId, treeLevel };
    });
    this.logger.log('用户滑落进入团队树: userId=' + userId);
    return result;
  }

  /**
   * 并发安全的"待位"放位（新规则：首次商城付款、上传付款截图即进树待位）。
   * - 用 Postgres 事务级 advisory lock 把所有放位全局串行化：杜绝并发时多个
   *   事务同时读到同一空位，导致一个节点出现 4+ 个直接下级；
   * - 严格按"商城付款截图上传"的调用先后（即提交时间先后）串行排位，某节点
   *   满 3 个直接下级后，第 4 人由 BFS 滑到下一级空位；
   * - 幂等：用户已在团队树则跳过；
   * - 放位后校正升 4 级咨询任务收款人（直推=邀请人；上级类按待位 path）。
   * 返回放位结果；无邀请人或已在树返回 null。
   */
  async placePendingUser(
    userId: string,
  ): Promise<{ parentId: string | null; treeLevel: number; path: string } | null> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user?.inviterId) return null;
    const inviterId: string = user.inviterId;
    const ADMIN_ID = '4b51567f-8020-415c-8b5d-1de2f28e141d';

    return await this.db.transaction(async (tx) => {
      // 全局串行放位：固定 advisory lock key，事务结束自动释放
      await tx.execute(sql`SELECT pg_advisory_xact_lock(872341)`);

      const existRows = await tx
        .select()
        .from(teamRelations)
        .where(eq(teamRelations.userId, userId))
        .limit(1);
      if (existRows.length > 0) return null; // 已在树，幂等跳过

      // BFS 找第一个直接下级不足 3 人的节点（在串行锁内，计数准确）
      const placement = await this.findParentForSliding(tx, inviterId);
      const treeLevel = placement.parentRelation
        ? placement.parentRelation.treeLevel + 1
        : 1;
      const basePath = placement.parentRelation
        ? placement.parentRelation.path
        : ',' + inviterId + ',';
      const path = basePath + userId + ',';
      const childCountRows = await tx
        .select({ c: sql<number>`count(*)` })
        .from(teamRelations)
        .where(eq(teamRelations.parentId, placement.parentId));
      const position = Number(childCountRows[0]?.c ?? 0);

      await tx.insert(teamRelations).values({
        userId,
        parentId: placement.parentId,
        inviterId,
        treeLevel,
        path,
        position,
      });
      await tx
        .update(users)
        .set({ parentId: placement.parentId, treeLevel })
        .where(eq(users.id, userId));

      const ancestorIds = path
        .split(',')
        .filter((s) => s.length > 0 && s !== userId);
      if (ancestorIds.length > 0) {
        await tx
          .update(users)
          .set({ teamTotalCount: sql`${users.teamTotalCount} + 1` })
          .where(
            sql`${users.id} = ANY(ARRAY[${sql.join(
              ancestorIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}]::uuid[])`,
          );
      }

      // 校正升 4 级咨询任务收款人：task1=直推(邀请人)；task2/3/4=待位 path depth1/2/3
      const segs = path.split(',').filter((s) => s.length > 0);
      const ancestorAt = (depth: number): string | null => {
        const idx = segs.length - depth - 1;
        return idx >= 0 ? segs[idx] ?? null : null;
      };
      const lvl4Tasks = await tx
        .select()
        .from(upgradeTasks)
        .where(
          and(
            eq(upgradeTasks.userId, userId),
            eq(upgradeTasks.toLevel, LEVELS.LEVEL_4),
            eq(upgradeTasks.taskType, 'consult_service'),
          ),
        );
      for (const t of lvl4Tasks) {
        if (t.status === 'completed') continue; // 已完成任务不动
        let targetId: string | null =
          t.taskIndex === 1 ? inviterId : ancestorAt(t.taskIndex - 1);
        if (!targetId) targetId = ADMIN_ID; // 无上级指向平台管理员，绝不指向本人
        const patch: Record<string, string> = {};
        if (targetId !== t.targetId) patch.targetId = targetId;
        if (t.status !== 'in_progress') patch.status = 'in_progress'; // 进树锁定位置后解锁
        if (Object.keys(patch).length > 0) {
          await tx
            .update(upgradeTasks)
            .set(patch)
            .where(eq(upgradeTasks.id, t.id));
        }
      }

      return { parentId: placement.parentId, treeLevel, path };
    });
  }

  private makeToken(user: UserSelect): string {
    return generateToken({
      userId: user.id,
      phone: user.phone,
      level: user.level,
      isInvited: user.isInvited,
    });
  }

  private getLevelLayer(level: string): number {
    const layerMap: Record<string, number> = {
      [LEVELS.JUNIOR]: 0,
      [LEVELS.LEVEL_4]: 4,
      [LEVELS.LEVEL_5]: 5,
      [LEVELS.LEVEL_6]: 6,
      [LEVELS.LEVEL_7]: 7,
      [LEVELS.LEVEL_8]: 8,
    };
    return layerMap[level] ?? 0;
  }

  /** 有效直推人数：直接邀请 + 已完成4级任务(level<>junior) + 真实在团队树中；排除已淘汰号 */
  private async countEffectiveDirect(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(teamRelations, eq(teamRelations.userId, users.id))
      .where(and(
        eq(users.inviterId, userId),
        ne(users.level, 'junior'),
        sql`${users.assessmentStatus} IS DISTINCT FROM 'eliminated'`,
      ));
    return rows[0]?.n ?? 0;
  }

  private toUserInfo(user: UserSelect): UserInfo {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      gender: user.gender ?? undefined,
      age: user.age ?? undefined,
      level: user.level,
      isInvited: user.isInvited,
      inviterId: user.inviterId ?? undefined,
      parentId: user.parentId ?? undefined,
      inviteCode: user.inviteCode ?? undefined,
      receiveAddress: user.receiveAddress ?? undefined,
      receivePhone: user.receivePhone ?? undefined,
      industry: user.industry ?? undefined,
      qualification: user.qualification ?? undefined,
      serviceStandard: user.serviceStandard ?? undefined,
      wechatQrcodeUrl: user.wechatQrcodeUrl ?? undefined,
      alipayQrcodeUrl: user.alipayQrcodeUrl ?? undefined,
      companyQrcodeUrl: user.companyQrcodeUrl ?? undefined,
      businessLicenseUrl: user.businessLicenseUrl ?? undefined,
      idCardFrontUrl: user.idCardFrontUrl ?? undefined,
      idCardBackUrl: user.idCardBackUrl ?? undefined,
      idCardNumber: user.idCardNumber ?? undefined,
      realName: user.realName ?? undefined,
      address: user.address ?? undefined,
      wechatId: user.wechatId ?? undefined,
      companyAuditStatus: user.companyAuditStatus ?? undefined,
      isSeller: (user as any).isSeller ?? false,
      sellerStatus: (user as any).sellerStatus ?? undefined,
      totalConsultIncome: String(user.totalConsultIncome),
      thresholdBlocked: user.thresholdBlocked,
      thresholdTriggeredAt: user.thresholdTriggeredAt
        ? user.thresholdTriggeredAt.toISOString()
        : undefined,
      pendingReclaimAmount: String(user.pendingReclaimAmount),
      overflowLossAmount: String(user.overflowLossAmount),
      permanentLossAmount: String((user as any).permanentLossAmount ?? '0'),
      directInviteCount: user.directInviteCount,
      teamTotalCount: user.teamTotalCount,
      treeLevel: user.treeLevel,
      assessmentStatus: user.assessmentStatus ?? 'none',
      fourStarAt: user.fourStarAt ? user.fourStarAt.toISOString() : undefined,
      platformCollectedAmount: String(user.platformCollectedAmount ?? '0'),
      refundRate: user.refundRate ?? undefined,
      refundedAmount: String(user.refundedAmount ?? '0'),
      refundStatus: user.refundStatus ?? 'none',
      isClone: user.isClone ?? false,
      cloneOfId: user.cloneOfId ?? undefined,
      replacementForId: user.replacementForId ?? undefined,
      cloneEligible: user.cloneEligible ?? false,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

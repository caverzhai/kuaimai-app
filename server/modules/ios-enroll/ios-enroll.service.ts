import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// 平台对外可访问地址（mobileconfig 回传地址必须公网可达）
const BASE_URL =
  process.env.PUBLIC_BASE_URL || 'https://backend-production-5d79.up.railway.app';

// 一次性申请令牌有效期（分钟）
const TOKEN_TTL_MINUTES = 30;

export interface IosDeviceRow {
  id: string;
  userId: string;
  udid: string;
  serial: string | null;
  product: string | null;
  deviceName: string | null;
  iosVersion: string | null;
  imei: string | null;
  status: 'pending' | 'packaged';
  createdAt: Date;
  updatedAt: Date;
  nickname?: string;
  phone?: string;
  realName?: string;
}

@Injectable()
export class IosEnrollService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async onModuleInit() {
    try {
      // 一次性申请令牌（绑定账号，短期有效，用后作废）
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS ios_enroll_tokens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          token varchar(64) NOT NULL UNIQUE,
          user_id uuid NOT NULL,
          expires_at timestamptz(3) NOT NULL,
          used boolean NOT NULL DEFAULT false,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // iOS 独立安装申请（设备 UDID 关联到账号）
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS ios_device_applications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL,
          udid varchar(64) NOT NULL,
          serial varchar(100),
          product varchar(64),
          device_name varchar(100),
          ios_version varchar(32),
          imei varchar(40),
          status varchar(20) NOT NULL DEFAULT 'pending',
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, udid)
        )
      `);
      await this.db.execute(
        sql`CREATE INDEX IF NOT EXISTS idx_ios_enroll_tokens_token ON ios_enroll_tokens(token)`,
      );
      await this.db.execute(
        sql`CREATE INDEX IF NOT EXISTS idx_ios_device_app_user ON ios_device_applications(user_id)`,
      );
      await this.db.execute(
        sql`CREATE INDEX IF NOT EXISTS idx_ios_device_app_status ON ios_device_applications(status)`,
      );
      console.log('[Migration] iOS UDID 收集相关表已确保存在');
    } catch (err) {
      console.error('[Migration] iOS UDID 表迁移失败', err);
    }
  }

  private levelLayer(level: string): number {
    const map: Record<string, number> = {
      level_4: 4,
      level_5: 5,
      level_6: 6,
      level_7: 7,
      level_8: 8,
      level_9: 9,
    };
    return map[level] ?? 0;
  }

  /**
   * 会员在 App 内发起申请：校验 4 级及以上，生成一次性令牌与专属 enroll 链接。
   * 会员用目标 iPhone 打开该链接（扫码 / Safari），安装描述文件后 UDID 自动关联本账号。
   */
  async start(
    userId: string,
    level: string,
  ): Promise<{ token: string; enrollUrl: string; expiresAt: Date }> {
    if (this.levelLayer(level) < 4) {
      throw new ForbiddenException('仅 4 级及以上咨询师可申请苹果手机独立安装');
    }
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    await this.db.execute(sql`
      INSERT INTO ios_enroll_tokens (token, user_id, expires_at)
      VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
    `);
    const enrollUrl = `${BASE_URL}/ios-enroll/profile?token=${token}`;
    return { token, enrollUrl, expiresAt };
  }

  /** 校验一次性申请令牌（存在、未使用、未过期），返回所属账号 */
  async validateEnrollToken(token: string): Promise<{ userId: string }> {
    if (!token) {
      throw new BadRequestException('缺少申请令牌，请在 App 内重新生成');
    }
    const res = await this.db.execute(sql`
      SELECT user_id, expires_at, used
      FROM ios_enroll_tokens
      WHERE token = ${token}
    `);
    const rows = Array.from(res as any) as Array<{
      user_id: string;
      expires_at: Date | string;
      used: boolean;
    }>;
    if (rows.length === 0) {
      throw new BadRequestException('申请链接无效，请在 App 内重新生成');
    }
    const row = rows[0];
    if (row.used) {
      throw new BadRequestException('该申请已使用，请在 App 内重新生成');
    }
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      throw new BadRequestException('申请链接已过期，请在 App 内重新生成');
    }
    return { userId: row.user_id };
  }

  /** 生成 enroll 描述文件（Profile Service）：设备安装后向 registerUrl 回传设备属性 */
  buildEnrollProfile(token: string): string {
    const registerUrl = `${BASE_URL}/ios-enroll/register?token=${token}`;
    const payloadUuid = crypto.randomUUID().toUpperCase();
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <dict>
    <key>URL</key>
    <string>${registerUrl}</string>
    <key>DeviceAttributes</key>
    <array>
      <string>UDID</string>
      <string>IMEI</string>
      <string>OS_VERSION</string>
      <string>PRODUCT</string>
      <string>SERIAL</string>
      <string>DEVICE_NAME</string>
      <string>MODEL</string>
    </array>
  </dict>
  <key>PayloadDisplayName</key>
  <string>AI快卖 · 设备验证</string>
  <key>PayloadIdentifier</key>
  <string>com.kuaimai.app.enroll</string>
  <key>PayloadOrganization</key>
  <string>AI快卖</string>
  <key>PayloadType</key>
  <string>Profile Service</string>
  <key>PayloadUUID</key>
  <string>${payloadUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
  }

  /** Profile Service 完成后返回的最终描述文件（空内容，仅用于走完安装流程） */
  private buildFinalProfile(): string {
    const payloadUuid = crypto.randomUUID().toUpperCase();
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array/>
  <key>PayloadDisplayName</key>
  <string>AI快卖 · 设备已登记</string>
  <key>PayloadIdentifier</key>
  <string>com.kuaimai.app.enrolled</string>
  <key>PayloadOrganization</key>
  <string>AI快卖</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${payloadUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
  }

  /**
   * 设备回传：校验一次性令牌，解析 plist 中的 UDID / 设备信息，
   * 关联账号落库，作废令牌，返回最终描述文件。
   */
  async register(token: string, plistText: string): Promise<{ profileXml: string }> {
    if (!token) throw new BadRequestException('缺少申请令牌，请重新扫码');
    const tokenRes = await this.db.execute(sql`
      SELECT id, user_id, expires_at, used
      FROM ios_enroll_tokens
      WHERE token = ${token}
    `);
    const tokenRows = Array.from(tokenRes as any) as Array<{
      id: string;
      user_id: string;
      expires_at: Date | string;
      used: boolean;
    }>;
    if (tokenRows.length === 0) {
      throw new BadRequestException('申请链接无效，请在 App 内重新生成');
    }
    const tokenRow = tokenRows[0];
    if (tokenRow.used) {
      throw new BadRequestException('该申请已使用，请在 App 内重新生成');
    }
    if (new Date(tokenRow.expires_at as string).getTime() < Date.now()) {
      throw new BadRequestException('申请链接已过期，请在 App 内重新生成');
    }

    const udid = this.plistValue(plistText, 'UDID');
    if (!udid) {
      throw new BadRequestException('未能读取设备标识，请重试');
    }
    const serial = this.plistValue(plistText, 'SERIAL');
    const product = this.plistValue(plistText, 'PRODUCT');
    const deviceName = this.plistValue(plistText, 'DEVICE_NAME');
    const iosVersion = this.plistValue(plistText, 'OS_VERSION');
    const imei = this.plistValue(plistText, 'IMEI');

    // upsert：重复上报刷新设备信息，但不把"已打包"降级
    await this.db.execute(sql`
      INSERT INTO ios_device_applications
        (user_id, udid, serial, product, device_name, ios_version, imei, status)
      VALUES
        (${tokenRow.user_id}, ${udid}, ${serial}, ${product}, ${deviceName}, ${iosVersion}, ${imei}, 'pending')
      ON CONFLICT (user_id, udid) DO UPDATE SET
        serial = EXCLUDED.serial,
        product = EXCLUDED.product,
        device_name = EXCLUDED.device_name,
        ios_version = EXCLUDED.ios_version,
        imei = EXCLUDED.imei,
        _updated_at = CURRENT_TIMESTAMP
    `);

    await this.db.execute(sql`
      UPDATE ios_enroll_tokens SET used = true WHERE id = ${tokenRow.id}
    `);

    return { profileXml: this.buildFinalProfile() };
  }

  /** 会员查看自己已上报的设备 */
  async myDevices(userId: string): Promise<{ devices: IosDeviceRow[] }> {
    const res = await this.db.execute(sql`
      SELECT id, user_id, udid, serial, product, device_name, ios_version, imei,
             status, _created_at, _updated_at
      FROM ios_device_applications
      WHERE user_id = ${userId}
      ORDER BY _created_at DESC
    `);
    const devices = (Array.from(res as any) as any[]).map((r) => this.mapDevice(r));
    return { devices };
  }

  /** 管理员：全部申请（含账号昵称 / 手机号 / 实名） */
  async listAll(): Promise<{ devices: IosDeviceRow[] }> {
    const res = await this.db.execute(sql`
      SELECT a.id, a.user_id, a.udid, a.serial, a.product, a.device_name,
             a.ios_version, a.imei, a.status, a._created_at, a._updated_at,
             u.nickname, u.phone, u.real_name
      FROM ios_device_applications a
      JOIN users u ON u.id = a.user_id
      ORDER BY a._created_at DESC
    `);
    const devices = (Array.from(res as any) as any[]).map((r) => {
      const d = this.mapDevice(r);
      d.nickname = r.nickname ?? null;
      d.phone = r.phone ?? null;
      d.realName = r.real_name ?? null;
      return d;
    });
    return { devices };
  }

  /** 管理员：标记打包状态 */
  async setStatus(id: string, status: 'pending' | 'packaged'): Promise<{ ok: boolean }> {
    if (status !== 'pending' && status !== 'packaged') {
      throw new BadRequestException('状态值无效');
    }
    await this.db.execute(sql`
      UPDATE ios_device_applications
      SET status = ${status}, _updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `);
    return { ok: true };
  }

  private mapDevice(r: any): IosDeviceRow {
    return {
      id: r.id,
      userId: r.user_id,
      udid: r.udid,
      serial: r.serial ?? null,
      product: r.product ?? null,
      deviceName: r.device_name ?? null,
      iosVersion: r.ios_version ?? null,
      imei: r.imei ?? null,
      status: r.status,
      createdAt: r._created_at,
      updatedAt: r._updated_at,
    };
  }

  /** 从 Apple plist 文本中提取指定 key 的 <string> 值 */
  private plistValue(plist: string, key: string): string | null {
    if (!plist) return null;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<key>${escaped}</key>\\s*<string[^>]*>([\\s\\S]*?)</string>`,
      'i',
    );
    const m = plist.match(re);
    if (!m) return null;
    return this.decodeXml(m[1].trim());
  }

  private decodeXml(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  }
}

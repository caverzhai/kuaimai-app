import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '../../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const ADMIN_PHONE = '13800000000';
const ONLINE_WINDOW_SEC = 15;
const CHUNK_KEEP_MIN = 2;

export interface PublicUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
}

@Injectable()
export class MeetingService implements OnModuleInit {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private rows(r: any): any[] {
    return Array.isArray(r) ? r : r?.rows ?? [];
  }

  async onModuleInit() {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_rooms (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar(50) NOT NULL,
          is_permanent boolean NOT NULL DEFAULT true,
          host_id uuid,
          current_speaker_id uuid,
          is_active boolean NOT NULL DEFAULT true,
          created_by uuid,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_hand_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending',
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_audio_chunks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          sequence integer NOT NULL,
          speaker_id uuid NOT NULL,
          url text NOT NULL,
          duration integer NOT NULL DEFAULT 0,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_presence (
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          last_seen timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(room_id, user_id)
        )
      `);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meeting_hands ON meeting_hand_requests(room_id, status)`);
      await this.db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_chunk_seq ON meeting_audio_chunks(room_id, sequence)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meeting_chunk_room_seq ON meeting_audio_chunks(room_id, sequence)`);
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          content text NOT NULL,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_restrictions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL,
          user_id uuid NOT NULL,
          type varchar(10) NOT NULL,
          created_by uuid,
          until timestamptz,
          _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meeting_messages_room ON meeting_messages(room_id, _created_at)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meeting_restrictions_room_user ON meeting_restrictions(room_id, user_id, type)`);

      // 确保「1号会议室」常驻存在
      await this.db.execute(sql`
        INSERT INTO meeting_rooms(name, is_permanent, is_active)
        SELECT '1号会议室', true, true
        WHERE NOT EXISTS (SELECT 1 FROM meeting_rooms WHERE name = '1号会议室')
      `);
      // 初始主持人设为平台管理员
      await this.db.execute(sql`
        UPDATE meeting_rooms
        SET host_id = COALESCE(host_id, (SELECT id FROM users WHERE phone = ${ADMIN_PHONE} LIMIT 1)),
            created_by = COALESCE(created_by, (SELECT id FROM users WHERE phone = ${ADMIN_PHONE} LIMIT 1))
        WHERE name = '1号会议室' AND host_id IS NULL
      `);

      this.logger.log('会议室表与「1号会议室」已就绪');

      // 定时清理过期音频块 / 旧申请 / 离线 presence
      setInterval(() => this.cleanup().catch((e) => this.logger.error('cleanup error', e)), 120_000);
    } catch (err) {
      this.logger.error('会议室初始化失败', err);
    }
  }

  private async cleanup() {
    // 删除过期音频块（文件 best-effort）
    const expired = this.rows(await this.db.execute(sql`
      SELECT url FROM meeting_audio_chunks WHERE _created_at < NOW() - make_interval(mins => ${CHUNK_KEEP_MIN})
    `));
    for (const c of expired) {
      try {
        const u = String(c.url || '');
        const idx = u.indexOf('/uploads/meeting/');
        if (idx >= 0) {
          const publicDir = this.getPublicDir();
          const fp = path.join(publicDir, u.slice(idx + 1));
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      } catch {}
    }
    await this.db.execute(sql`DELETE FROM meeting_audio_chunks WHERE _created_at < NOW() - make_interval(mins => ${CHUNK_KEEP_MIN})`);
    await this.db.execute(sql`DELETE FROM meeting_hand_requests WHERE status <> 'pending' AND _created_at < NOW() - INTERVAL '2 hour'`);
    await this.db.execute(sql`DELETE FROM meeting_presence WHERE last_seen < NOW() - INTERVAL '1 minute'`);
    await this.db.execute(sql`DELETE FROM meeting_restrictions WHERE until IS NOT NULL AND until < NOW()`);
    // 兜底：定时清理所有房间 25 分钟前的文字消息（不依赖是否有人发新消息）
    await this.db.execute(sql`DELETE FROM meeting_messages WHERE _created_at < NOW() - INTERVAL '25 minutes'`);
  }

  // 会议室列表（至少返回 1号会议室）
  async getRoomList() {
    const r = this.rows(await this.db.execute(sql`
      SELECT id, name, is_permanent, host_id, current_speaker_id, is_active
      FROM meeting_rooms ORDER BY _created_at ASC
    `));
    return {
      items: r.map((x) => ({
        id: x.id,
        name: x.name,
        isPermanent: x.is_permanent,
        hostId: x.host_id,
        currentSpeakerId: x.current_speaker_id,
        isActive: x.is_active,
      })),
    };
  }

  private async requireRoom(roomId: string) {
    const r = this.rows(await this.db.execute(sql`
      SELECT * FROM meeting_rooms WHERE id = ${roomId} LIMIT 1
    `));
    if (!r.length) throw new NotFoundException('会议室不存在');
    return r[0];
  }

  // 完整状态同步（状态 + 在线 + 举手 + 新音频块）
  // 性能：全部查询合并为单条 CTE，只占用一个连接、一次数据库往返；
  // 避免连接池可用连接不足时，多个查询在同一连接上串行排队（实测 Promise.all 仍 ~10×往返）。
  async getState(roomId: string, userId: string, sinceSeq: number) {
    const since = Number.isFinite(sinceSeq) ? Math.max(0, Math.floor(sinceSeq)) : 0;

    const rows = this.rows(await this.db.execute(sql`
      WITH room AS (
        SELECT * FROM meeting_rooms WHERE id = ${roomId} LIMIT 1
      ),
      online AS (
        SELECT json_agg(json_build_object(
          'id', u.id, 'nickname', u.nickname, 'avatarUrl', u.avatar_url
        )) AS d
        FROM meeting_presence p JOIN users u ON u.id = p.user_id
        WHERE p.room_id = ${roomId} AND p.last_seen > NOW() - make_interval(secs => ${ONLINE_WINDOW_SEC})
      ),
      hands AS (
        SELECT json_agg(json_build_object(
          'id', h.id, 'userId', h.user_id, 'nickname', u.nickname, 'avatarUrl', u.avatar_url
        )) AS d
        FROM meeting_hand_requests h JOIN users u ON u.id = h.user_id
        WHERE h.room_id = ${roomId} AND h.status = 'pending'
      ),
      myhand AS (
        SELECT json_build_object('id', id, 'status', status) AS d
        FROM meeting_hand_requests
        WHERE room_id = ${roomId} AND user_id = ${userId}
        ORDER BY _created_at DESC LIMIT 1
      ),
      chunk_list AS (
        SELECT id, sequence, speaker_id, url, duration
        FROM meeting_audio_chunks
        WHERE room_id = ${roomId} AND sequence > ${since}
        ORDER BY sequence ASC LIMIT 80
      ),
      chunks AS (
        SELECT json_agg(json_build_object(
          'id', id, 'sequence', sequence, 'speakerId', speaker_id, 'url', url, 'duration', duration
        )) AS d FROM chunk_list
      ),
      maxseq AS (
        SELECT COALESCE(MAX(sequence), 0) AS d
        FROM meeting_audio_chunks WHERE room_id = ${roomId}
      ),
      restricts AS (
        SELECT json_agg(json_build_object(
          'type', r.type, 'userId', r.user_id, 'nickname', u.nickname, 'avatarUrl', u.avatar_url
        )) AS d
        FROM meeting_restrictions r JOIN users u ON u.id = r.user_id
        WHERE r.room_id = ${roomId} AND (r.until IS NULL OR r.until > NOW())
      ),
      hostspk AS (
        SELECT json_agg(json_build_object('id', id, 'nickname', nickname, 'avatarUrl', avatar_url)) AS d
        FROM users
        WHERE id IN (SELECT host_id FROM room) OR id IN (SELECT current_speaker_id FROM room)
      )
      SELECT
        (SELECT to_jsonb(room) FROM room) AS room,
        (SELECT d FROM online)    AS online,
        (SELECT d FROM hands)     AS hands,
        (SELECT d FROM myhand)    AS myhand,
        (SELECT d FROM chunks)    AS chunks,
        (SELECT d FROM maxseq)    AS maxseq,
        (SELECT d FROM restricts) AS restricts,
        (SELECT d FROM hostspk)   AS hostspk
    `));

    if (!rows.length || rows[0].room == null) {
      throw new NotFoundException('会议室不存在');
    }
    const row = rows[0];
    const room = row.room;

    const online: PublicUser[] = row.online ?? [];
    const hands = row.hands ?? [];
    const myHand = row.myhand ?? null;
    const chunks = row.chunks ?? [];
    const maxSeq = Number(row.maxseq ?? 0);
    const restrictRows: any[] = row.restricts ?? [];
    const hostSpeakerRows: any[] = row.hostspk ?? [];

    // 限制信息内存过滤：我的禁言/踢出 + 静音用户列表
    const myMuted = restrictRows.some((r) => r.userId === userId && r.type === 'mute');
    const myKicked = restrictRows.some((r) => r.userId === userId && r.type === 'kick');
    const mutedMap = new Map<string, PublicUser>();
    for (const r of restrictRows) {
      if (r.type === 'mute' && !mutedMap.has(r.userId)) {
        mutedMap.set(r.userId, { id: r.userId, nickname: r.nickname, avatarUrl: r.avatarUrl });
      }
    }
    const mutedUsers = [...mutedMap.values()];

    // 主持人 + 当前发言者
    const userMap = new Map(hostSpeakerRows.map((u: any) => [u.id, u]));
    const toPub = (u: any): PublicUser | null =>
      u ? { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl } : null;
    const host = room.host_id ? toPub(userMap.get(room.host_id)) : null;
    const currentSpeaker = room.current_speaker_id ? toPub(userMap.get(room.current_speaker_id)) : null;

    return {
      room: {
        id: room.id,
        name: room.name,
        isPermanent: room.is_permanent,
        isActive: room.is_active,
        hostId: room.host_id,
        currentSpeakerId: room.current_speaker_id,
      },
      host,
      currentSpeaker,
      online,
      hands,
      myHand,
      chunks,
      maxSeq,
      myMuted,
      myKicked,
      mutedUsers,
    };
  }

  private async getUserById(id: string | null | undefined): Promise<PublicUser | null> {
    if (!id) return null;
    const r = this.rows(await this.db.execute(sql`
      SELECT id, nickname, avatar_url FROM users WHERE id = ${id} LIMIT 1
    `));
    if (!r.length) return null;
    return { id: r[0].id, nickname: r[0].nickname, avatarUrl: r[0].avatar_url };
  }

  async heartbeat(roomId: string, userId: string) {
    await this.requireRoom(roomId);
    await this.db.execute(sql`
      INSERT INTO meeting_presence(room_id, user_id, last_seen)
      VALUES(${roomId}, ${userId}, CURRENT_TIMESTAMP)
      ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen
    `);
    return { success: true };
  }

  async leave(roomId: string, userId: string) {
    await this.db.execute(sql`DELETE FROM meeting_presence WHERE room_id = ${roomId} AND user_id = ${userId}`);
    return { success: true };
  }

  async raiseHand(roomId: string, userId: string) {
    const room = await this.requireRoom(roomId);
    if (room.current_speaker_id === userId) throw new BadRequestException('你当前已有发言权');
    const existing = this.rows(await this.db.execute(sql`
      SELECT id FROM meeting_hand_requests WHERE room_id = ${roomId} AND user_id = ${userId} AND status = 'pending' LIMIT 1
    `));
    if (existing.length) return { success: true, id: existing[0].id };
    const ins = this.rows(await this.db.execute(sql`
      INSERT INTO meeting_hand_requests(room_id, user_id, status) VALUES(${roomId}, ${userId}, 'pending') RETURNING id
    `));
    return { success: true, id: ins[0].id };
  }

  async cancelHand(roomId: string, userId: string) {
    await this.db.execute(sql`
      UPDATE meeting_hand_requests SET status = 'cancelled'
      WHERE room_id = ${roomId} AND user_id = ${userId} AND status = 'pending'
    `);
    return { success: true };
  }

  private isHostOrAdmin(room: any, userId: string, isAdmin: boolean) {
    return isAdmin || room.host_id === userId;
  }

  async approve(roomId: string, callerId: string, isAdmin: boolean, targetUserId: string) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可批准');
    const target = await this.getUserById(targetUserId);
    if (!target) throw new NotFoundException('用户不存在');
    await this.db.execute(sql`
      UPDATE meeting_rooms SET current_speaker_id = ${targetUserId}, _updated_at = CURRENT_TIMESTAMP WHERE id = ${roomId}
    `);
    await this.db.execute(sql`
      UPDATE meeting_hand_requests SET status = 'approved'
      WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND status = 'pending'
    `);
    return { success: true, currentSpeakerId: targetUserId };
  }

  async stop(roomId: string, callerId: string, isAdmin: boolean) {
    const room = await this.requireRoom(roomId);
    const canStop = isAdmin || room.host_id === callerId || room.current_speaker_id === callerId;
    if (!canStop) throw new ForbiddenException('无权结束发言');
    await this.db.execute(sql`
      UPDATE meeting_rooms SET current_speaker_id = NULL, _updated_at = CURRENT_TIMESTAMP WHERE id = ${roomId}
    `);
    return { success: true };
  }

  async assignHost(roomId: string, isAdmin: boolean, targetUserId: string) {
    if (!isAdmin) throw new ForbiddenException('仅管理员可指定主持人');
    await this.requireRoom(roomId);
    const target = await this.getUserById(targetUserId);
    if (!target) throw new NotFoundException('用户不存在');
    await this.db.execute(sql`
      UPDATE meeting_rooms SET host_id = ${targetUserId}, _updated_at = CURRENT_TIMESTAMP WHERE id = ${roomId}
    `);
    return { success: true, hostId: targetUserId };
  }

  // 发言者上传音频块（仅 currentSpeaker）；服务器存文件、分配 sequence、刷新在线
  async uploadChunk(roomId: string, callerId: string, base64: string, duration: number) {
    const room = await this.requireRoom(roomId);
    if (room.current_speaker_id !== callerId) {
      throw new ForbiddenException('你当前没有发言权');
    }
    if (!base64) throw new BadRequestException('音频数据为空');
    const m = String(base64).match(/^data:audio\/(\w+)(?:;[A-Za-z0-9.=/-]+)?;base64,(.+)$/);
    if (!m) throw new BadRequestException('音频格式无效');
    const buf = Buffer.from(m[2], 'base64');

    const publicDir = this.getPublicDir();
    const dir = path.join(publicDir, 'uploads', 'meeting');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `meeting_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.webm`;
    fs.writeFileSync(path.join(dir, filename), buf);

    const maxRow = this.rows(await this.db.execute(sql`
      SELECT COALESCE(MAX(sequence), 0) AS max_seq FROM meeting_audio_chunks WHERE room_id = ${roomId}
    `));
    const sequence = Number(maxRow[0]?.max_seq ?? 0) + 1;

    const baseUrl = process.env.APP_URL || 'https://backend-production-5d79.up.railway.app';
    const url = `${baseUrl}/uploads/meeting/${filename}`;

    await this.db.execute(sql`
      INSERT INTO meeting_audio_chunks(room_id, sequence, speaker_id, url, duration)
      VALUES(${roomId}, ${sequence}, ${callerId}, ${url}, ${Math.round(duration) || 0})
    `);
    // 发言即活跃，刷新在线状态
    await this.db.execute(sql`
      INSERT INTO meeting_presence(room_id, user_id, last_seen)
      VALUES(${roomId}, ${callerId}, CURRENT_TIMESTAMP)
      ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen
    `);

    return { success: true, sequence, url };
  }

  // ---------- 文字消息 ----------
  async getMessages(roomId: string, sinceTime: string | null) {
    await this.requireRoom(roomId);
    if (sinceTime) {
      const rows = this.rows(await this.db.execute(sql`
        SELECT m.id, m.user_id, u.nickname, u.avatar_url, m.content, m._created_at
        FROM meeting_messages m JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ${roomId} AND m._created_at >= ${sinceTime}
        ORDER BY m._created_at ASC LIMIT 100
      `));
      return { items: rows.map((r) => this.mapMsg(r)) };
    }
    const rows = this.rows(await this.db.execute(sql`
      SELECT m.id, m.user_id, u.nickname, u.avatar_url, m.content, m._created_at
      FROM meeting_messages m JOIN users u ON u.id = m.user_id
      WHERE m.room_id = ${roomId} ORDER BY m._created_at DESC LIMIT 50
    `));
    return { items: rows.reverse().map((r) => this.mapMsg(r)) };
  }

  private mapMsg(r: any) {
    return { id: r.id, userId: r.user_id, nickname: r.nickname, avatarUrl: r.avatar_url, content: r.content, createdAt: r._created_at };
  }

  async sendMessage(roomId: string, userId: string, content: string) {
    await this.requireRoom(roomId);
    // 自动清理25分钟前的文字消息
    await this.db.execute(sql`DELETE FROM meeting_messages WHERE room_id = ${roomId} AND _created_at < NOW() - INTERVAL '25 minutes'`);
    const text = String(content || '').trim();
    if (!text) throw new BadRequestException('消息不能为空');
    if (text.length > 300) throw new BadRequestException('消息不能超过300字');
    const muted = this.rows(await this.db.execute(sql`
      SELECT 1 FROM meeting_restrictions WHERE room_id = ${roomId} AND user_id = ${userId} AND type = 'mute' AND (until IS NULL OR until > NOW()) LIMIT 1
    `));
    if (muted.length) throw new ForbiddenException('你已被主持人禁言');
    const ins = this.rows(await this.db.execute(sql`
      INSERT INTO meeting_messages(room_id, user_id, content) VALUES(${roomId}, ${userId}, ${text}) RETURNING id
    `));
    await this.db.execute(sql`
      INSERT INTO meeting_presence(room_id, user_id, last_seen) VALUES(${roomId}, ${userId}, CURRENT_TIMESTAMP)
      ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen
    `);
    return { success: true, id: ins[0]?.id };
  }

  // ---------- 主持人：禁言 / 踢人 ----------
  async clearMessages(roomId: string, callerId: string, isAdmin: boolean) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可操作');
    await this.db.execute(sql`DELETE FROM meeting_messages WHERE room_id = ${roomId}`);
    return { success: true };
  }

  async muteUser(roomId: string, callerId: string, isAdmin: boolean, targetUserId: string, minutes?: number) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可操作');
    const target = await this.getUserById(targetUserId);
    if (!target) throw new NotFoundException('用户不存在');
    await this.db.execute(sql`DELETE FROM meeting_restrictions WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND type = 'mute'`);
    const until = minutes && minutes > 0 ? sql`NOW() + make_interval(mins => ${minutes})` : sql`NULL`;
    await this.db.execute(sql`INSERT INTO meeting_restrictions(room_id, user_id, type, created_by, until) VALUES(${roomId}, ${targetUserId}, 'mute', ${callerId}, ${until})`);
    return { success: true };
  }

  async unmuteUser(roomId: string, callerId: string, isAdmin: boolean, targetUserId: string) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可操作');
    await this.db.execute(sql`DELETE FROM meeting_restrictions WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND type = 'mute'`);
    return { success: true };
  }

  async kickUser(roomId: string, callerId: string, isAdmin: boolean, targetUserId: string) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可操作');
    if (targetUserId === callerId) throw new BadRequestException('不能踢自己');
    if (room.host_id === targetUserId && !isAdmin) throw new ForbiddenException('仅管理员可踢主持人');
    const target = await this.getUserById(targetUserId);
    if (!target) throw new NotFoundException('用户不存在');
    await this.db.execute(sql`DELETE FROM meeting_restrictions WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND type = 'kick'`);
    await this.db.execute(sql`INSERT INTO meeting_restrictions(room_id, user_id, type, created_by, until) VALUES(${roomId}, ${targetUserId}, 'kick', ${callerId}, NOW() + make_interval(hours => 1))`);
    await this.db.execute(sql`DELETE FROM meeting_presence WHERE room_id = ${roomId} AND user_id = ${targetUserId}`);
    return { success: true };
  }

  async unkickUser(roomId: string, callerId: string, isAdmin: boolean, targetUserId: string) {
    const room = await this.requireRoom(roomId);
    if (!this.isHostOrAdmin(room, callerId, isAdmin)) throw new ForbiddenException('仅主持人可操作');
    await this.db.execute(sql`DELETE FROM meeting_restrictions WHERE room_id = ${roomId} AND user_id = ${targetUserId} AND type = 'kick'`);
    return { success: true };
  }

  private getPublicDir(): string {
    const possiblePublicDirs = [
      path.join(process.cwd(), 'server', 'public'),
      path.join(process.cwd(), 'public'),
      path.join(process.cwd(), 'dist', 'public'),
      path.join(process.cwd(), 'server', 'dist', 'public'),
      path.join(__dirname, '..', '..', '..', '..', 'public'),
      path.join(__dirname, '..', '..', '..', 'public'),
    ];
    for (const dir of possiblePublicDirs) {
      if (fs.existsSync(dir)) return dir;
    }
    const firstDir = possiblePublicDirs[0];
    fs.mkdirSync(firstDir, { recursive: true });
    return firstDir;
  }
}

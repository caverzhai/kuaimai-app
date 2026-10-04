import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { systemNotifications, platformNotices, mallOrders, consultOrders } from '@server/database/schema';
import { Subject } from 'rxjs';
import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

export interface SendNotificationDTO {
  target: 'all' | 'user'; // all=全员广播，user=指定用户
  userId?: string;
  title: string;
  body: string;
  type?: 'system' | 'update'; // system=普通通知，update=版本更新
  payload?: Record<string, any> | null;
}

export interface AppNotification {
  id: string;
  seq: number;
  userId: string | null;
  title: string;
  body: string;
  type: 'system' | 'update' | 'collect';
  payload: Record<string, any> | null;
  silent?: boolean; // collect：订单已离开待处理窗口（错过自动确认），静默补达、不响铃
  createdAt: any;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // 兼容 jsonb 中对象 / 历史双重编码字符串两种存储，统一返回对象
  private parsePayload(p: any): Record<string, any> | null {
    if (p === null || p === undefined) return null;
    if (typeof p === 'string') {
      try {
        const o = JSON.parse(p);
        return typeof o === 'string'
          ? (JSON.parse(o) as Record<string, any>)
          : (o as Record<string, any>);
      } catch {
        return null;
      }
    }
    return p as Record<string, any>;
  }

  private mapRow(r: any): AppNotification {
    return {
      id: r.id,
      seq: Number(r.seq),
      userId: r.userId ?? null,
      title: r.title,
      body: r.body,
      type: r.type,
      payload: this.parsePayload(r.payload),
      createdAt: r.createdAt,
    };
  }

  // 管理员发送一条通知（全员广播 / 指定用户）
  async send(dto: SendNotificationDTO, adminUserId: string): Promise<AppNotification> {
    const userId = dto.target === 'user' && dto.userId ? dto.userId : null;
    const rows = await this.db
      .insert(systemNotifications)
      .values({
        userId,
        title: dto.title,
        body: dto.body,
        type: dto.type ?? 'system',
        payload: dto.payload ?? null,
        createdBy: adminUserId,
      })
      .returning();
    return this.mapRow(rows[0]);
  }

  // 系统自动生成：待收款 / 待审核提醒（type=collect）。通知失败不影响业务主流程。
  async createCollect(
    targetUserId: string,
    title: string,
    body: string,
    payload?: Record<string, any> | null,
  ): Promise<AppNotification | null> {
    if (!targetUserId) return null;
    try {
      const rows = await this.db
        .insert(systemNotifications)
        .values({
          userId: targetUserId,
          title,
          body,
          type: 'collect',
          payload: payload ?? null,
        })
        .returning();
      const n = this.mapRow(rows[0]);
      // 前台实时推送（SSE）：卖家 App 在前台时立即收到，不必等 30 秒轮询
      this.pushToUser(targetUserId, { type: 'collect', notification: n });
      return n;
    } catch {
      return null;
    }
  }

  // ── SSE 连接注册表：userId -> 该用户当前的前台连接（可能多端） ──
  private streams = new Map<string, Set<Subject<any>>>();

  addStream(userId: string): Subject<any> {
    const subj = new Subject<any>();
    if (!this.streams.has(userId)) this.streams.set(userId, new Set());
    this.streams.get(userId)!.add(subj);
    return subj;
  }

  removeStream(userId: string, subj: Subject<any>): void {
    const set = this.streams.get(userId);
    if (!set) return;
    set.delete(subj);
    if (set.size === 0) this.streams.delete(userId);
  }

  private pushToUser(userId: string, evt: any): void {
    const set = this.streams.get(userId);
    if (!set) return;
    set.forEach((s) => {
      try {
        s.next({ data: evt });
      } catch {
        // ignore
      }
    });
  }

  // 用户拉取自己应收到的通知：
  //   ① 增量（个人 + 全员广播，seq>after）；② 该用户所有"未成功送达(acked=false)"的 collect。
  //   两部分合并去重 → 保证收款通知"至少送达一次"，不再因错过 180 秒自动确认窗口而永久丢失。
  async getPending(
    userId: string,
    afterSeq: number,
  ): Promise<{ notifications: AppNotification[]; clearedOrderIds: string[] }> {
    const incRows = await this.db
      .select()
      .from(systemNotifications)
      .where(
        and(
          gt(systemNotifications.seq, afterSeq),
          or(isNull(systemNotifications.userId), eq(systemNotifications.userId, userId)),
        ),
      )
      .orderBy(asc(systemNotifications.seq))
      .limit(50);

    // 未 ack 的 collect（不限 seq）：漏发补偿，持续返回直到客户端确认已处理
    const unackedRows = await this.db
      .select()
      .from(systemNotifications)
      .where(
        and(
          eq(systemNotifications.userId, userId),
          eq(systemNotifications.type, 'collect'),
          eq(systemNotifications.acked, false),
        ),
      )
      .orderBy(asc(systemNotifications.seq))
      .limit(50);

    const byId = new Map<string, any>();
    for (const r of incRows) byId.set(r.id, r);
    for (const r of unackedRows) if (!byId.has(r.id)) byId.set(r.id, r);
    const rows = [...byId.values()].sort((a, b) => Number(a.seq) - Number(b.seq));

    // 批量查这些 collect 对应订单的当前状态
    const mallIds: string[] = [];
    const consultIds: string[] = [];
    for (const r of rows) {
      if (r.type !== 'collect') continue;
      const pl = this.parsePayload(r.payload);
      const oid = pl?.orderId as string | undefined;
      if (pl?.kind === 'mall' && oid) mallIds.push(oid);
      else if (pl?.kind === 'consult' && oid) consultIds.push(oid);
    }

    const mallStatus = new Map<string, string>();
    if (mallIds.length) {
      const mr = await this.db
        .select({ id: mallOrders.id, status: mallOrders.status })
        .from(mallOrders)
        .where(inArray(mallOrders.id, mallIds));
      for (const o of mr) mallStatus.set(o.id, o.status);
    }

    const consultStatus = new Map<string, string>();
    if (consultIds.length) {
      const cr = await this.db
        .select({ id: consultOrders.id, status: consultOrders.status })
        .from(consultOrders)
        .where(inArray(consultOrders.id, consultIds));
      for (const o of cr) consultStatus.set(o.id, o.status);
    }

    // 订单状态三档：
    //   live   待收款/待审核（mall pending_review / consult pending_confirm）→ 响铃 + 弹窗
    //   silent 已收款待发货/服务中（mall pending_shipment / consult in_service）→ 静默入栏，不响不弹
    //   dead   已发货/完成/取消/订单不存在 → 收款流程已结束，服务端自动 ack、不再返回，
    //          并把 orderId 放入 clearedOrderIds，供客户端取消该订单残留的通知/弹窗
    const deadIds: string[] = [];
    const clearedOrderIds: string[] = [];
    const out: AppNotification[] = [];
    for (const r of rows) {
      const m = this.mapRow(r);
      if (m.type !== 'collect') {
        out.push(m);
        continue;
      }
      const oid = (m.payload?.orderId as string | undefined) ?? '';
      const status =
        m.payload?.kind === 'mall'
          ? mallStatus.get(oid)
          : m.payload?.kind === 'consult'
            ? consultStatus.get(oid)
            : undefined;
      if (status === 'pending_review' || status === 'pending_confirm') {
        m.silent = false;
        out.push(m);
      } else if (status === 'pending_shipment' || status === 'in_service') {
        m.silent = true;
        out.push(m);
      } else {
        deadIds.push(r.id);
        if (oid) clearedOrderIds.push(oid);
      }
    }

    // 已结束的收款通知：服务端自动确认（按 id 批量），失败则下轮再处理
    if (deadIds.length) {
      try {
        await this.db
          .update(systemNotifications)
          .set({ acked: true })
          .where(inArray(systemNotifications.id, deadIds));
      } catch {
        // ignore
      }
    }
    return { notifications: out, clearedOrderIds };
  }

  // 客户端确认该 collect 通知已成功处理（已交给系统通知栏 / 已展示），标记已送达
  async ack(userId: string, id: string): Promise<{ ok: boolean }> {
    try {
      await this.db
        .update(systemNotifications)
        .set({ acked: true })
        .where(and(eq(systemNotifications.id, id), eq(systemNotifications.userId, userId)));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // 管理员查看已发通知
  async listAll(limit = 100): Promise<AppNotification[]> {
    const rows = await this.db
      .select()
      .from(systemNotifications)
      .orderBy(asc(systemNotifications.seq))
      .limit(limit);
    return rows.map((r) => this.mapRow(r));
  }

  // 平台公告：获取当前内容
  async getCurrentNotice(): Promise<{ content: string; updatedAt: any }> {
    const rows = await this.db.select().from(platformNotices).limit(1);
    if (rows.length === 0) return { content: '', updatedAt: null };
    return { content: rows[0].content, updatedAt: rows[0].updatedAt };
  }

  // 平台公告：管理员更新内容（单条，存在则更新，不存在则插入）
  async updateNotice(content: string, adminUserId: string): Promise<{ content: string }> {
    const existing = await this.db.select().from(platformNotices).limit(1);
    if (existing.length > 0) {
      await this.db
        .update(platformNotices)
        .set({ content, updatedBy: adminUserId, updatedAt: new Date() })
        .where(eq(platformNotices.id, existing[0].id));
    } else {
      await this.db.insert(platformNotices).values({ content, updatedBy: adminUserId });
    }
    return { content };
  }
}

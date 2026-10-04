import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import {
  ArrowLeft,
  Mic,
  Hand,
  Users,
  Radio,
  ShieldCheck,
  Crown,
  XCircle,
  Check,
  MessageCircle,
  Send,
  UserX,
  Ban,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCache, setCache } from '../../utils/cache';
import { getErrorMessage } from '../../utils/errorMessage';
import {
  getMeetingState,
  meetingHeartbeat,
  meetingLeave,
  meetingRaiseHand,
  meetingCancelHand,
  meetingApprove,
  meetingStop,
  meetingAssignHost,
  meetingUploadChunk,
  getMeetingMessages,
  meetingSendMessage,
  meetingMute,
  meetingUnmute,
  meetingKick,
  meetingUnkick,
} from '../../api';

const ADMIN_PHONE = '13800000000';
const POLL_MS = 2000;
const HEARTBEAT_MS = 8000;
const CHUNK_MS = 1500;

interface QueueItem {
  seq: number;
  speakerId: string;
  audio: HTMLAudioElement;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', ''];
  for (const m of candidates) {
    try {
      if (m && MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return '';
}

const MeetingRoomPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const id = meetingId as string;
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id;
  const isAdmin = user?.phone === ADMIN_PHONE;

  const UI_KEY = `meeting_ui_${id}`;
  const MSGS_KEY = `meeting_msgs_${id}`;
  // 无缓存时的默认空界面：进入即可见完整框架，绝不白屏等待网络
  const makeDefaultUi = (): any => ({
    room: { id, name: '1号会议室', isPermanent: true, isActive: true, hostId: null, currentSpeakerId: null },
    host: null,
    currentSpeaker: null,
    online: [],
    hands: [],
    myHand: null,
    myMuted: false,
    myKicked: false,
    mutedUsers: [],
  });

  const [entered, setEntered] = useState(false);
  const [ui, setUi] = useState<any>(() => getCache<any>(UI_KEY, true));
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<any[]>(() => getCache<any[]>(MSGS_KEY, true) ?? []);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgTextRef = useRef('');
  const msgSendingRef = useRef(false);
  const actionsRef = useRef<any>(null);

  const handleEnter = async () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        const ac = new AC();
        if (ac.resume) await ac.resume();
      }
    } catch {}
    // 与 setEntered 同批更新：立即显示缓存或默认界面，网络请求在 effect 后台进行
    setUi((prev) => prev || makeDefaultUi());
    setEntered(true);
  };

  useEffect(() => {
    if (!entered || !myId) return;

    let cancelled = false;
    const stateRef: { current: any } = { current: null };
    const lastSeqRef = { current: 0 };
    const lastMsgTimeRef = { current: '' as string };
    const queue: QueueItem[] = [];
    let curAudio: HTMLAudioElement | null = null;
    let prevSpeaker: string | null = null;

    // 发言相关
    let speaking = false;
    let localStream: MediaStream | null = null;
    let curRecorder: MediaRecorder | null = null;
    let chunkTimer: any = null;
    let uploadBlocked = false;

    const errMsg = (e: any, action = '会议室操作') =>
      getErrorMessage(e, action);

    // ---------- 收听播放 ----------
    const playNext = () => {
      const spk = stateRef.current?.room?.currentSpeakerId;
      while (queue.length && queue[0].speakerId !== spk) queue.shift();
      const item = queue.shift();
      if (!item) {
        curAudio = null;
        return;
      }
      const a = item.audio;
      curAudio = a;
      const done = () => {
        if (curAudio === a) curAudio = null;
        playNext();
      };
      a.onended = done;
      a.onerror = done;
      a.play().catch(() => done());
    };
    const ensurePlaying = () => {
      if (!curAudio) playNext();
    };
    const stopAudioOf = (speakerId: string | null) => {
      if (curAudio && (curAudio as any)._speakerId === speakerId) {
        curAudio.onended = null;
        try { curAudio.pause(); } catch {}
        curAudio = null;
      }
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].speakerId === speakerId) queue.splice(i, 1);
      }
    };

    // ---------- 同步 ----------
    const heartbeat = async () => {
      try { await meetingHeartbeat(id); } catch {}
    };
    const sync = async () => {
      try {
        // 文字消息请求与状态请求并行发起，避免串行等待；UI 不被消息阻塞
        const msgPromise = getMeetingMessages(id, lastMsgTimeRef.current || undefined).catch(() => null);
        const s = await getMeetingState(id, stateRef.current ? lastSeqRef.current : 0);
        if (cancelled) return;
        const newSpeaker = s.room?.currentSpeakerId;
        if (prevSpeaker !== newSpeaker) {
          if (newSpeaker !== myId) stopAudioOf(prevSpeaker);
          prevSpeaker = newSpeaker;
        }
        for (const c of s.chunks || []) {
          if (c.speakerId === myId) continue;
          if (c.speakerId !== newSpeaker) continue;
          const audio = new Audio(c.url);
          audio.preload = 'auto';
          (audio as any)._speakerId = c.speakerId;
          queue.push({ seq: c.sequence, speakerId: c.speakerId, audio });
        }
        lastSeqRef.current = s.maxSeq;
        stateRef.current = s;
        // 状态就绪立即渲染会议室主界面（不等文字消息），并写缓存供下次秒开
        const uiData = {
          room: s.room,
          host: s.host,
          currentSpeaker: s.currentSpeaker,
          online: s.online,
          hands: s.hands,
          myHand: s.myHand,
          myMuted: !!s.myMuted,
          myKicked: !!s.myKicked,
          mutedUsers: s.mutedUsers || [],
        };
        setUi(uiData);
        setCache(UI_KEY, uiData);
        // 被主持人移出：提示并退出
        if (s.myKicked) {
          toast.error('你已被主持人移出会议室');
          setTimeout(() => navigate(-1), 900);
          return;
        }
        // 新文字消息（与状态并行拉取，按时间戳增量去重）
        const m = await msgPromise;
        if (!cancelled && m?.items?.length) {
          setMessages((prev) => {
            const existing = new Set(prev.map((x: any) => x.id));
            const fresh = m.items.filter((x: any) => !existing.has(x.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          lastMsgTimeRef.current = m.items[m.items.length - 1].createdAt;
        }
        // 我在发言但发言权已被收回/转移：自动停录
        if (speaking && newSpeaker !== myId) reclaimLocal();
        if (newSpeaker && newSpeaker !== myId) ensurePlaying();
      } catch {}
    };

    // ---------- 发言 ----------
    const cycle = () => {
      if (!speaking || !localStream) return;
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(localStream, { mimeType: pickMime() } as any);
      } catch {
        rec = new MediaRecorder(localStream);
      }
      const parts: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) parts.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(parts, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 0 && !uploadBlocked) {
          blobToBase64(blob)
            .then((b64) => meetingUploadChunk(id, b64, CHUNK_MS))
            .catch(() => {});
        }
        if (speaking && !cancelled) cycle();
      };
      curRecorder = rec;
      rec.start();
      chunkTimer = setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, CHUNK_MS);
    };

    const startSpeak = async () => {
      if (speaking || busy) return;
      setBusy(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStream = stream;
        speaking = true;
        uploadBlocked = false;
        setIsSpeaking(true);
        cycle();
        toast.success('已开始发言');
      } catch (e) {
        toast.error('无法访问麦克风：' + errMsg(e));
      } finally {
        setBusy(false);
      }
    };

    const stopSpeak = async () => {
      if (!speaking) return;
      speaking = false;
      setIsSpeaking(false);
      clearTimeout(chunkTimer);
      const rec = curRecorder;
      if (rec && rec.state === 'recording') {
        try { rec.stop(); } catch {}
      }
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
      try { await meetingStop(id); } catch {}
      toast.success('已结束发言');
      sync();
    };

    // 发言权被主持人收回 / 转给他人：本地停录，不调 stop、不上传尾块
    const reclaimLocal = () => {
      if (!speaking) return;
      speaking = false;
      uploadBlocked = true;
      setIsSpeaking(false);
      clearTimeout(chunkTimer);
      const rec = curRecorder;
      if (rec && rec.state === 'recording') { try { rec.stop(); } catch {} }
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
      toast.info('发言权已被主持人收回');
    };

    // ---------- 举手 / 主持控制 ----------
    const toggleHand = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const pending = stateRef.current?.myHand?.status === 'pending';
        if (pending) { await meetingCancelHand(id); toast.success('已取消申请'); }
        else { await meetingRaiseHand(id); toast.success('已举手，等待主持人批准'); }
        await sync();
      } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const hostSpeak = async () => {
      if (busy) return;
      setBusy(true);
      try {
        await meetingApprove(id, myId);
        await startSpeak();
      } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const approveUser = async (userId: string) => {
      setBusy(true);
      try { await meetingApprove(id, userId); await sync(); toast.success('已交给该用户发言'); }
      catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const takeBack = async () => {
      setBusy(true);
      try { await meetingStop(id); await sync(); toast.success('已收回话筒'); }
      catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const assignHost = async (userId: string) => {
      setBusy(true);
      try { await meetingAssignHost(id, userId); await sync(); toast.success('主持人已更新'); }
      catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    const sendMsg = async () => {
      const text = msgTextRef.current.trim();
      if (!text || msgSendingRef.current) return;
      msgSendingRef.current = true;
      setMsgSending(true);
      try {
        const res: any = await meetingSendMessage(id, text);
        const now = new Date().toISOString();
        setMessages((prev) => [...prev, { id: res?.id || `local-${Date.now()}`, userId: myId, nickname: user?.nickname || '我', content: text, createdAt: now }]);
        lastMsgTimeRef.current = now;
        setMsgText(''); msgTextRef.current = '';
      } catch (e) { toast.error(errMsg(e)); } finally { msgSendingRef.current = false; setMsgSending(false); }
    };
    const muteUser = async (userId: string) => { setBusy(true); try { await meetingMute(id, userId); await sync(); toast.success('已禁言该用户'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
    const unmuteUser = async (userId: string) => { setBusy(true); try { await meetingUnmute(id, userId); await sync(); toast.success('已解除禁言'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
    const kickUser = async (userId: string) => { setBusy(true); try { await meetingKick(id, userId); await sync(); toast.success('已移出该用户'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };

    actionsRef.current = { startSpeak, stopSpeak, toggleHand, hostSpeak, approveUser, takeBack, assignHost, sendMsg, muteUser, unmuteUser, kickUser };

    heartbeat();
    sync();
    const poll = setInterval(sync, POLL_MS);
    const hb = setInterval(heartbeat, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(hb);
      clearTimeout(chunkTimer);
      speaking = false;
      if (curRecorder && curRecorder.state === 'recording') { try { curRecorder.stop(); } catch {} }
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      if (curAudio) { try { curAudio.pause(); } catch {} }
      queue.length = 0;
      meetingLeave(id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, myId]);

  // 新消息自动滚到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 消息变化即写缓存（含自己发送的），下次进入先显示历史讨论
  useEffect(() => {
    if (entered) setCache(MSGS_KEY, messages);
  }, [messages, entered]);

  // ---------- 进入门 ----------
  if (!entered) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-600 flex flex-col items-center justify-center px-6 text-white">
        <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
          <Radio className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold mb-2">1号会议室</h1>
        <p className="text-white/85 text-sm text-center leading-relaxed mb-8 max-w-xs">
          同一时刻仅 1 人发言，其他人收听。点按下方按钮进入，可举手申请发言，由主持人安排。
        </p>
        <button
          onClick={handleEnter}
          className="w-full max-w-xs py-3.5 bg-white text-orange-600 rounded-full font-bold text-lg shadow-lg active:scale-95 transition"
        >
          点击进入会议室
        </button>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-white/80 text-sm flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <Toaster position="top-center" />
      </div>
    );
  }

  if (!ui) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">正在进入会议室…</div>
        <Toaster position="top-center" />
      </div>
    );
  }

  const amISpeaker = ui.room.currentSpeakerId === myId;
  const handPending = ui.myHand?.status === 'pending';
  const isHost = ui.room.hostId === myId || isAdmin;
  const online: any[] = ui.online || [];
  const hands: any[] = ui.hands || [];
  const mutedUsers: any[] = ui.mutedUsers || [];
  const myMuted = !!ui.myMuted;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}>
      {/* 顶部栏 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex items-center gap-1.5 font-bold text-gray-800">
          <Radio className="w-5 h-5 text-orange-500" />
          {ui.room.name}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          {online.length}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* 当前发言者主卡 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center">
          {ui.currentSpeaker ? (
            <>
              <div className="relative mb-4">
                {amISpeaker && isSpeaking && (
                  <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
                )}
                <div className="w-24 h-24 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center ring-4 ring-orange-200 relative">
                  {ui.currentSpeaker.avatarUrl ? (
                    <img src={ui.currentSpeaker.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Mic className="w-10 h-10 text-orange-400" />
                  )}
                </div>
              </div>
              <div className="font-bold text-gray-800 text-lg flex items-center gap-1.5">
                {ui.currentSpeaker.nickname}
                {amISpeaker && <span className="text-orange-500 text-sm">（我）</span>}
              </div>
              {amISpeaker && !isSpeaking ? (
                <>
                  <div className="mt-2 flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Check className="w-4 h-4" /> 已获得发言权
                  </div>
                  <div className="mt-1 text-xs text-gray-400">点下方「开始发言」即可讲话</div>
                </>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-1 text-red-500 text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    正在发言
                  </div>
                  {/* 音波条 */}
                  <div className="mt-3 flex items-end gap-1 h-6">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <span
                        key={i}
                        className="w-1 bg-orange-400 rounded-full animate-pulse"
                        style={{ height: '100%', animationDelay: `${i * 0.12}s`, animationDuration: '0.7s' }}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Mic className="w-10 h-10 text-gray-300" />
              </div>
              <div className="font-bold text-gray-500">当前无人发言</div>
              <div className="mt-1 text-sm text-gray-400">安静中，可举手申请发言</div>
            </>
          )}
          {/* 主持人标识 */}
          {ui.host && (
            <div className="mt-4 flex items-center gap-1 text-xs text-gray-400">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              主持人：{ui.host.nickname}
            </div>
          )}
        </div>

        {/* 文字讨论 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col" style={{ height: 260 }}>
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            文字讨论
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-10">暂无消息，说点什么吧</p>
            ) : (
              messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.userId === myId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${m.userId === myId ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.userId !== myId && <div className="text-[11px] text-gray-500 font-medium mb-0.5">{m.nickname}</div>}
                    <div className="break-words whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 主持人控制台 */}
        {isHost && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              主持控制台
            </h3>
            {ui.currentSpeaker && (
              <button
                onClick={() => actionsRef.current?.takeBack()}
                disabled={busy}
                className="w-full mb-3 py-2.5 border border-red-300 text-red-500 rounded-xl font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> 收回话筒
              </button>
            )}
            {hands.length === 0 ? (
              <p className="text-sm text-gray-400">暂无举手申请</p>
            ) : (
              <div className="space-y-2">
                {hands.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center flex-shrink-0">
                      {h.avatarUrl ? (
                        <img src={h.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Hand className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1 font-medium text-sm text-gray-700">{h.nickname}</div>
                    <button
                      onClick={() => actionsRef.current?.approveUser(h.userId)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> 批准
                    </button>
                  </div>
                ))}
              </div>
            )}
            {mutedUsers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Ban className="w-3.5 h-3.5 text-red-500" /> 被禁言（{mutedUsers.length}）</p>
                <div className="flex flex-wrap gap-2">
                  {mutedUsers.map((u: any) => (
                    <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs">
                      {u.nickname}
                      <button onClick={() => actionsRef.current?.unmuteUser(u.id)} disabled={busy} className="underline disabled:opacity-40">解除</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 在线成员 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-blue-500" />
            在线成员（{online.length}）
          </h3>
          <div className="grid grid-cols-6 gap-3">
            {online.map((o) => (
              <div key={o.id} className="flex flex-col items-center gap-1">
                <div className="relative w-11 h-11 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  {o.avatarUrl ? (
                    <img src={o.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-gray-400">{(o.nickname || '?').charAt(0)}</span>
                  )}
                  {o.id === ui.room.hostId && (
                    <Crown className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-amber-500 bg-white rounded-full" />
                  )}
                </div>
                {isAdmin && o.id !== ui.room.hostId && o.id !== myId && (
                  <button
                    onClick={() => actionsRef.current?.assignHost(o.id)}
                    disabled={busy}
                    className="text-[10px] text-blue-500 leading-none disabled:opacity-40"
                  >
                    设主持
                  </button>
                )}
                {isHost && o.id !== myId && (
                  <div className="flex gap-1.5">
                    <button onClick={() => actionsRef.current?.kickUser(o.id)} disabled={busy} className="text-[10px] text-red-500 leading-none disabled:opacity-40 flex items-center gap-0.5"><UserX className="w-2.5 h-2.5" />踢</button>
                    {mutedUsers.find((x: any) => x.id === o.id) ? (
                      <button onClick={() => actionsRef.current?.unmuteUser(o.id)} disabled={busy} className="text-[10px] text-green-600 leading-none disabled:opacity-40">解禁</button>
                    ) : (
                      <button onClick={() => actionsRef.current?.muteUser(o.id)} disabled={busy} className="text-[10px] text-amber-600 leading-none disabled:opacity-40">禁言</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部主操作区 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 pt-3 z-20" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2 mb-2">
          <input
            value={msgText}
            onChange={(e) => { setMsgText(e.target.value); msgTextRef.current = e.target.value; }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); actionsRef.current?.sendMsg(); } }}
            disabled={myMuted || msgSending}
            placeholder={myMuted ? '你已被主持人禁言' : '说点什么…（300字内）'}
            maxLength={300}
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm outline-none focus:bg-gray-200 disabled:opacity-60"
          />
          <button
            onClick={() => actionsRef.current?.sendMsg()}
            disabled={msgSending || !msgText.trim() || myMuted}
            className="p-2.5 bg-orange-500 text-white rounded-full disabled:opacity-40 active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {amISpeaker && isSpeaking ? (
          <button
            onClick={() => actionsRef.current?.stopSpeak()}
            className="w-full py-3.5 bg-red-500 text-white rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <XCircle className="w-5 h-5" /> 结束发言
          </button>
        ) : amISpeaker ? (
          <button
            onClick={() => actionsRef.current?.startSpeak()}
            disabled={busy}
            className="w-full py-3.5 bg-green-500 text-white rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Mic className="w-5 h-5" /> 开始发言
          </button>
        ) : isHost ? (
          <button
            onClick={() => actionsRef.current?.hostSpeak()}
            disabled={busy}
            className="w-full py-3.5 bg-orange-500 text-white rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Mic className="w-5 h-5" /> 我要发言
          </button>
        ) : handPending ? (
          <button
            onClick={() => actionsRef.current?.toggleHand()}
            disabled={busy}
            className="w-full py-3.5 border border-amber-400 text-amber-600 rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Hand className="w-5 h-5" /> 申请中 · 点击取消
          </button>
        ) : (
          <button
            onClick={() => actionsRef.current?.toggleHand()}
            disabled={busy}
            className="w-full py-3.5 bg-orange-500 text-white rounded-full font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Hand className="w-5 h-5" /> 举手申请发言
          </button>
        )}
      </div>
      <Toaster position="top-center" />
    </div>
  );
};

export default MeetingRoomPage;

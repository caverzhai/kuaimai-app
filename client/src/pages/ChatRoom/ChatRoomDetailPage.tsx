import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getChatRoomDetail,
  getChatMessages,
  sendChatMessage,
  takeMic,
  leaveMic,
  requestMic,
  getMicRequests,
  approveMicRequest,
  rejectMicRequest,
} from '../../api';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { uploadImageToServer } from '../../utils/imageUpload';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Image as ImageIcon,
  Send,
  Smile,
  MoreVertical,
  Volume2,
  Play,
  Pause,
  Clock,
  Users,
  X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  avatarUrl?: string;
  type: 'text' | 'image' | 'audio' | 'system';
  content: string;
  duration?: number;
  createdAt: string;
}

interface MicSlot {
  slotIndex: number;
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

interface RoomDetail {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'personal';
  maxMicCount: number;
  myRole: string;
  isMuted: boolean;
  micSlots: MicSlot[];
}

// 表情列表
const EMOJIS = ['😀', '😂', '🤣', '😊', '😍', '🤔', '😎', '😭', '😡', '👍', '👎', '❤️', '🎉', '🔥', '💯', '🙏', '👏', '🤝', '💪', '🌟'];

const ChatRoomDetailPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isOnMic, setIsOnMic] = useState(false);
  const [micRequests, setMicRequests] = useState<any[]>([]);
  const [myMicRequestStatus, setMyMicRequestStatus] = useState<string | null>(null);
  const [showMicRequests, setShowMicRequests] = useState(false);
  const isAdmin = user?.phone === '13800000000';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isRecordingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const recordStartTimeRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await getChatRoomDetail(roomId);
      setRoom(data);
      setIsOnMic(data.micSlots.some((m: MicSlot) => m.userId === user?.id));
    } catch (err: any) {
      setError(err.response?.data?.message || '加载聊天室失败');
    }
  }, [roomId, user?.id]);

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await getChatMessages(roomId, 100);
      setMessages(data.items || []);
      scrollToBottom();
    } catch (err: any) {
      console.error('加载消息失败', err);
    }
  }, [roomId, scrollToBottom]);

  useEffect(() => {
    const init = async () => {
      await loadRoom();
      await loadMessages();
      setLoading(false);
    };
    init();

    // 每5秒轮询新消息（优化性能，减少请求频率）
    const msgInterval = setInterval(loadMessages, 5000);
    // 每15秒刷新聊天室信息（麦位）
    const roomInterval = setInterval(loadRoom, 15000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(roomInterval);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // 停止正在播放的语音
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, [loadRoom, loadMessages]);

  const handleSendText = async () => {
    if (!inputText.trim() || sending) return;
    if (room?.isMuted) {
      setError('你已被禁言');
      return;
    }
    setSending(true);
    try {
      await sendChatMessage(roomId!, {
        type: 'text',
        content: inputText.trim(),
      });
      setInputText('');
      setShowEmoji(false);
      loadMessages();
    } catch (err: any) {
      setError(err.response?.data?.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (room?.isMuted) {
      setError('你已被禁言');
      return;
    }
    setSending(true);
    try {
      // 先上传图片
      const imageUrl = await uploadImageToServer(file);
      await sendChatMessage(roomId!, {
        type: 'image',
        content: imageUrl,
      });
      loadMessages();
    } catch (err: any) {
      setError(err.response?.data?.message || '发送图片失败');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    // 防止重复调用（移动端onTouchStart和onMouseDown都会触发）
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    if (room?.isMuted) {
      setError('你已被禁言');
      isRecordingRef.current = false;
      return;
    }
    // 先清除之前的定时器
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    try {
      // 请求麦克风权限
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr: any) {
        isRecordingRef.current = false;
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          setError('麦克风权限被拒绝，请在手机设置中允许快卖使用麦克风');
        } else if (permErr.name === 'NotFoundError') {
          setError('未检测到麦克风设备');
        } else {
          setError('无法访问麦克风：' + permErr.message);
        }
        return;
      }

      // 如果在等待权限期间用户已经松开按钮，直接停止
      if (shouldStopRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        isRecordingRef.current = false;
        shouldStopRef.current = false;
        setError('录音时间太短');
        return;
      }
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          // 用时间戳计算真实时长，避免定时器计数不准
          const duration = Math.max(1, Math.round((Date.now() - recordStartTimeRef.current) / 1000));
          setIsRecording(false);
          setRecordingTime(0);
          stream.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current = null;

          if (duration < 1) {
            setError('录音时间太短');
            return;
          }

          if (audioBlob.size === 0) {
            setError('录音数据为空，请重试');
            return;
          }

          setSending(true);
          setError('');

          // 上传语音文件 - 转base64上传
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64 = reader.result as string;
              console.log('[Voice] 上传语音，大小:', base64.length);
              const response = await axiosForBackend.post('/api/upload/audio', { base64 });
              console.log('[Voice] 上传响应:', response.data);
              if (!response.data.success || !response.data.url) {
                throw new Error(response.data.message || '语音上传失败');
              }
              const audioUrl = response.data.url;
              await sendChatMessage(roomId!, {
                type: 'audio',
                content: audioUrl,
                duration,
              });
              await loadMessages();
              setSending(false);
            } catch (uploadErr: any) {
              console.error('[Voice] 上传失败:', uploadErr);
              setError(uploadErr.response?.data?.message || uploadErr.message || '语音上传失败');
              setSending(false);
            }
          };
          reader.onerror = () => {
            setError('语音文件读取失败');
            setSending(false);
          };
        } catch (err: any) {
          console.error('[Voice] 录音处理失败:', err);
          setError(err.message || '语音处理失败');
          setSending(false);
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      recordStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);

      // 用时间戳更新显示时长，更准确
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - recordStartTimeRef.current) / 1000);
        setRecordingTime(elapsed);
        if (elapsed >= 30) {
          stopRecording();
        }
      }, 200);
    } catch (err) {
      console.error('[Voice] 启动录音失败:', err);
      setError('无法访问麦克风，请检查权限');
      isRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    // 防止重复调用
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    shouldStopRef.current = false;

    // 如果录音器还没创建好（等待权限中），设置标志让它自动停止
    if (!mediaRecorderRef.current) {
      shouldStopRef.current = true;
      return;
    }

    try {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.error('[Voice] 停止录音失败:', e);
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const handleMicToggle = async () => {
    if (!room || room.type !== 'public') return;
    try {
      if (isOnMic) {
        await leaveMic(roomId!);
        setIsOnMic(false);
      } else if (isAdmin) {
        // 管理员可以直接上麦
        await takeMic(roomId!);
        setIsOnMic(true);
      } else {
        // 普通用户需要申请上麦
        await requestMic(roomId!);
        setMyMicRequestStatus('pending');
        setError('申请已提交，请等待管理员审核');
      }
      loadRoom();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    }
  };

  // 加载上麦申请列表
  const loadMicRequests = useCallback(async () => {
    if (!roomId || !isAdmin) return;
    try {
      const data = await getMicRequests(roomId);
      setMicRequests(data.items || []);
    } catch (err) {
      console.error('加载上麦申请列表失败', err);
    }
  }, [roomId, isAdmin]);

  // 管理员同意上麦申请
  const handleApproveRequest = async (requestId: string) => {
    try {
      await approveMicRequest(roomId!, requestId);
      setError('已同意上麦申请');
      loadMicRequests();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    }
  };

  // 管理员拒绝上麦申请
  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectMicRequest(roomId!, requestId);
      setError('已拒绝上麦申请');
      loadMicRequests();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    }
  };

  const playAudio = (messageId: string, audioUrl: string) => {
    // 如果点击的是当前正在播放的语音，则停止
    if (playingAudioId === messageId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    // 停止之前正在播放的语音
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setPlayingAudioId(messageId);
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;

    audio.onended = () => {
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
      setPlayingAudioId(null);
    };

    audio.onerror = () => {
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
      setPlayingAudioId(null);
      setError('语音播放失败');
    };

    audio.play().catch(() => {
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
      setPlayingAudioId(null);
    });
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error || '聊天室不存在'}</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-100 flex flex-col overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b shadow-sm flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-800">{room.name}</h1>
          {room.description && (
            <p className="text-xs text-gray-400 truncate">{room.description}</p>
          )}
        </div>
        {/* 顶部右侧无按钮 */}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 text-red-600 rounded text-sm text-center">
          {error}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>暂无消息，来说点什么吧</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gray-500">{msg.nickname.charAt(0)}</span>
                  )}
                </div>
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`text-xs text-gray-400 mb-1 ${isMe ? 'text-right' : ''}`}>
                    {msg.nickname}
                  </div>
                  {msg.type === 'text' && (
                    <div
                      className={`px-3 py-2 rounded-2xl ${
                        isMe
                          ? 'bg-orange-500 text-white rounded-tr-sm'
                          : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  {msg.type === 'image' && (
                    <div className="rounded-lg overflow-hidden max-w-[200px]">
                      <img
                        src={msg.content}
                        alt="图片"
                        className="w-full h-auto rounded-lg"
                        onClick={() => window.open(msg.content, '_blank')}
                      />
                    </div>
                  )}
                  {msg.type === 'audio' && (
                    <button
                      onClick={() => playAudio(msg.id, msg.content)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${
                        isMe
                          ? 'bg-orange-500 text-white rounded-tr-sm'
                          : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, Math.ceil((msg.duration || 1) / 6)))].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded ${
                              playingAudioId === msg.id ? 'animate-pulse' : ''
                            } ${isMe ? 'bg-white/70' : 'bg-gray-300'}`}
                            style={{ height: `${8 + i * 3}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-xs">{msg.duration}"</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 表情面板 */}
      {showEmoji && (
        <div className="bg-white border-t p-3 grid grid-cols-10 gap-2 flex-shrink-0 max-h-40 overflow-y-auto">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              className="text-2xl p-1 hover:bg-gray-100 rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 底部输入栏 */}
      <div className="bg-white border-t px-3 py-3 flex items-center gap-2 flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="p-2.5 text-gray-500 flex-shrink-0"
        >
          <Smile className="w-7 h-7" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-500 flex-shrink-0"
        >
          <ImageIcon className="w-7 h-7" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        {isRecording ? (
          <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-full px-4 py-2.5 min-w-0">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-red-500 font-medium text-base truncate">录音中 {recordingTime}s</span>
            <button
              onClick={stopRecording}
              className="ml-auto px-4 py-1.5 bg-red-500 text-white rounded-full text-sm flex-shrink-0"
            >
              发送
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
              placeholder={room.isMuted ? '你已被禁言' : '说点什么...'}
              disabled={room.isMuted}
              className="flex-1 min-w-0 px-4 py-2.5 bg-gray-100 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            />
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              className="p-2.5 text-gray-500 flex-shrink-0"
            >
              <Mic className="w-7 h-7" />
            </button>
            <button
              onClick={handleSendText}
              disabled={!inputText.trim() || sending}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-full text-base font-medium disabled:bg-gray-300 disabled:text-gray-500 flex-shrink-0"
            >
              发送
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatRoomDetailPage;

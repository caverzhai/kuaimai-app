import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getChatRoomList,
  getFriendList,
  createPersonalChatRoom,
  closeChatRoom,
  createRoomApplication,
  getRoomApplications,
  approveRoomApplication,
  rejectRoomApplication,
} from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Users,
  Plus,
  Mic,
  Lock,
  X,
  Trash2,
  AlertTriangle,
  Clock,
  Phone,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'personal';
  createdBy: string;
  maxMicCount: number;
  memberCount: number;
  micSlots: Array<{
    slotIndex: number;
    userId: string;
    nickname: string;
    avatarUrl?: string;
  }>;
  createdAt: string;
}

interface Friend {
  id: string;
  friendId: string;
  nickname: string;
  avatarUrl?: string;
  phone: string;
}

interface RoomApplication {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl?: string;
  roomName: string;
  description: string;
  usageTime: string;
  contactPhone: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  roomId?: string;
  createdAt: string;
}

const ChatRoomListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [applications, setApplications] = useState<RoomApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [personalRoomName, setPersonalRoomName] = useState('');
  const [error, setError] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState<string | null>(null);

  // 申请表单状态
  const [applyRoomName, setApplyRoomName] = useState('');
  const [applyDescription, setApplyDescription] = useState('');
  const [applyStartTime, setApplyStartTime] = useState('');
  const [applyEndTime, setApplyEndTime] = useState('');
  const [applyContactPhone, setApplyContactPhone] = useState('');
  const [applyAgreed, setApplyAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.phone === '13800000000';

  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [roomData, friendData, appData] = await Promise.all([
        getChatRoomList(),
        getFriendList().catch(() => ({ items: [] })),
        getRoomApplications().catch(() => ({ items: [] })),
      ]);
      setRooms(roomData.items || []);
      setFriends(friendData.items || []);
      setApplications(appData.items || []);
    } catch (err: any) {
      setError(err.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      if (!showApplyModal && !showPersonalModal && !showCloseConfirm) {
        loadData(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, showApplyModal, showPersonalModal, showCloseConfirm]);

  const handleSubmitApplication = async () => {
    if (!applyRoomName.trim()) {
      setError('请输入聊天室名称');
      return;
    }
    if (applyRoomName.length > 12) {
      setError('聊天室名称不能超过12个汉字');
      return;
    }
    if (!applyDescription.trim()) {
      setError('请输入聊天室说明');
      return;
    }
    if (applyDescription.length > 50) {
      setError('聊天室说明不能超过50字');
      return;
    }
    if (!applyStartTime) {
      setError('请选择开始时间');
      return;
    }
    if (!applyEndTime) {
      setError('请选择结束时间');
      return;
    }
    if (new Date(applyEndTime) <= new Date(applyStartTime)) {
      setError('结束时间必须晚于开始时间');
      return;
    }
    if (!/^1\d{10}$/.test(applyContactPhone)) {
      setError('请输入正确的11位手机号');
      return;
    }
    if (!applyAgreed) {
      setError('请阅读并同意合法合规声明');
      return;
    }

    setSubmitting(true);
    try {
      const usageTimeStr = `${applyStartTime.replace('T', ' ')} ~ ${applyEndTime.replace('T', ' ')}`;
      await createRoomApplication({
        roomName: applyRoomName.trim(),
        description: applyDescription.trim(),
        usageTime: usageTimeStr,
        contactPhone: applyContactPhone.trim(),
        scheduledStartTime: applyStartTime,
        scheduledEndTime: applyEndTime,
      });
      setShowApplyModal(false);
      setApplyRoomName('');
      setApplyDescription('');
      setApplyStartTime('');
      setApplyEndTime('');
      setApplyContactPhone('');
      setApplyAgreed(false);
      setError('');
      toast.success('申请提交成功！管理员审核后将自动准时上线');
      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || '提交失败，请重试';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePersonalRoom = async () => {
    if (selectedFriends.length === 0) {
      setError('请选择至少一个好友');
      return;
    }
    try {
      await createPersonalChatRoom({
        name: personalRoomName || '好友聊天室',
        memberIds: selectedFriends,
      });
      setShowPersonalModal(false);
      setSelectedFriends([]);
      setPersonalRoomName('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || '创建失败');
    }
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCloseRoom = async (roomId: string) => {
    try {
      await closeChatRoom(roomId);
      setShowCloseConfirm(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || '关闭失败');
    }
  };

  const handleApproveApplication = async (appId: string) => {
    try {
      await approveRoomApplication(appId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    }
  };

  const handleRejectApplication = async (appId: string) => {
    try {
      await rejectRoomApplication(appId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待审核';
      case 'approved': return '已通过';
      case 'rejected': return '已拒绝';
      case 'expired': return '已过期';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const publicRooms = rooms.filter((r) => r.type === 'public');
  const personalRooms = rooms.filter((r) => r.type === 'personal');
  const pendingApplications = applications.filter((a) => a.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部标题栏 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold">聊天室</h1>
        </div>
        <div className="flex gap-2">
          {friends.length > 0 && (
            <button
              onClick={() => setShowPersonalModal(true)}
              className="p-2 bg-blue-50 text-blue-600 rounded-full"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-full text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>申请我的聊天室</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 聊天室列表 - 统一展示运行中和申请中 */}
      <div className="p-4">
        {/* 全部聊天室 - 封面网格（运行中绿色，申请中灰色） */}
        {(publicRooms.length > 0 || pendingApplications.length > 0) && (
          <>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-orange-500" />
              全部聊天室
              <span className="text-xs text-gray-400 font-normal">（运行中绿色 / 申请中灰色）</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* 运行中的聊天室 - 绿色封面 */}
              {publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="relative rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform cursor-pointer"
                  onClick={() => navigate(`/chat-room/${room.id}`)}
                >
                  {/* 封面 - 绿色渐变 */}
                  <div className="h-28 bg-gradient-to-br from-green-400 to-emerald-600 relative">
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-white font-bold text-base truncate drop-shadow-lg">
                        {room.name}
                      </h3>
                    </div>
                    {/* 运行中标签 */}
                    <div className="absolute top-2 left-2 bg-green-500/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-xs">运行中</span>
                    </div>
                    {/* 在线人数 */}
                    <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">{room.memberCount}</span>
                    </div>
                    {/* 管理员关闭按钮 */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCloseConfirm(room.id);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 bg-black/30 backdrop-blur-sm rounded-full text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* 信息区 */}
                  <div className="bg-white p-3">
                    {room.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 h-8 leading-4">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Mic className="w-3 h-3" />
                        {room.micSlots.length}人在麦
                      </span>
                      <span className="text-xs text-green-600 font-medium">进入 →</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 申请中的聊天室 - 灰色封面 */}
              {pendingApplications.map((app) => (
                <div
                  key={app.id}
                  className="relative rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform cursor-pointer"
                  onClick={() => {
                    if (isAdmin) {
                      // 管理员点击弹出审批选项
                      if (confirm(`同意创建聊天室「${app.roomName}」？\n\n申请人：${app.nickname}\n说明：${app.description}\n时间：${app.usageTime}\n电话：${app.contactPhone}`)) {
                        handleApproveApplication(app.id);
                      }
                    }
                  }}
                >
                  {/* 封面 - 灰色 */}
                  <div className="h-28 bg-gradient-to-br from-gray-400 to-gray-600 relative">
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-white font-bold text-base truncate drop-shadow-lg">
                        {app.roomName}
                      </h3>
                    </div>
                    {/* 申请中标签 */}
                    <div className="absolute top-2 left-2 bg-gray-700/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">申请中</span>
                    </div>
                    {/* 时间段 */}
                    <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-white text-xs">{app.usageTime}</span>
                    </div>
                  </div>
                  {/* 信息区 */}
                  <div className="bg-white p-3">
                    <p className="text-xs text-gray-500 line-clamp-2 h-8 leading-4">
                      {app.description}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {app.contactPhone}
                      </span>
                      {isAdmin ? (
                        <span className="text-xs text-orange-500 font-medium">点击审批 →</span>
                      ) : (
                        <span className="text-xs text-gray-400">等待审核</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 个人聊天室 */}
        {personalRooms.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
              <Lock className="w-4 h-4 text-gray-500" />
              好友聊天室
            </h2>
            <div className="space-y-2 mb-6">
              {personalRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white rounded-xl p-3 shadow-sm active:scale-98 transition-transform flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/chat-room/${room.id}`)}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate">{room.name}</h3>
                    <p className="text-xs text-gray-400">{room.memberCount}人</p>
                  </div>
                  <span className="text-xs text-blue-500">进入 →</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 我的申请记录（已通过/已拒绝/已过期） */}
        {applications.filter((a) => a.status !== 'pending').length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
              <FileText className="w-4 h-4 text-gray-500" />
              我的申请记录
            </h2>
            <div className="space-y-2">
              {applications.filter((a) => a.status !== 'pending').map((app) => (
                <div key={app.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800">{app.roomName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                      {getStatusText(app.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{app.description}</p>
                  {app.status === 'approved' && app.roomId && (
                    <button
                      onClick={() => navigate(`/chat-room/${app.roomId}`)}
                      className="mt-2 w-full py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium"
                    >
                      进入聊天室
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {rooms.length === 0 && applications.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="mb-2">暂无聊天室</p>
            <button
              onClick={() => setShowApplyModal(true)}
              className="text-orange-500 text-sm font-medium"
            >
              点击申请创建聊天室
            </button>
          </div>
        )}
      </div>

      {/* 申请聊天室弹窗 */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">申请聊天室</h3>
              <button onClick={() => setShowApplyModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              {/* 错误提示 */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {/* 合法警告 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium mb-1">合法合规声明</p>
                    <p className="text-xs leading-relaxed">
                      1. 本聊天室仅用于合法的行业交流、咨询服务和知识分享；
                      2. 禁止发布违法违规、色情低俗、赌博诈骗、政治敏感等内容；
                      3. 禁止进行任何形式的非法交易、资金传销和非法集资活动；
                      4. 管理员审核通过后电话联系安排上线，违规将被永久关闭。
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  聊天室名称 <span className="text-gray-400 text-xs">（12个汉字以内）</span>
                </label>
                <input
                  type="text"
                  value={applyRoomName}
                  onChange={(e) => setApplyRoomName(e.target.value)}
                  placeholder="请输入聊天室名称"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  maxLength={12}
                />
                <div className="text-right text-xs text-gray-400 mt-1">{applyRoomName.length}/12</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  聊天室说明 <span className="text-gray-400 text-xs">（50字以内）</span>
                </label>
                <textarea
                  value={applyDescription}
                  onChange={(e) => setApplyDescription(e.target.value)}
                  placeholder="请简要说明聊天室的主题和内容"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 h-20 resize-none"
                  maxLength={50}
                />
                <div className="text-right text-xs text-gray-400 mt-1">{applyDescription.length}/50</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                <input
                  type="datetime-local"
                  value={applyStartTime}
                  onChange={(e) => setApplyStartTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                <input
                  type="datetime-local"
                  value={applyEndTime}
                  onChange={(e) => setApplyEndTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="tel"
                  value={applyContactPhone}
                  onChange={(e) => setApplyContactPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="管理员审核通过后电话联系"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  maxLength={11}
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAgreed}
                  onChange={(e) => setApplyAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-orange-500"
                />
                <span className="text-sm text-gray-600">我已阅读并同意遵守上述合法合规声明，承诺合法使用聊天室</span>
              </label>
              <button
                onClick={handleSubmitApplication}
                disabled={submitting || !applyAgreed}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                提交后管理员将在1-3个工作日内电话联系您
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 创建个人聊天室弹窗 */}
      {showPersonalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPersonalModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">创建好友聊天室</h3>
              <button onClick={() => setShowPersonalModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聊天室名称（选填）</label>
                <input
                  type="text"
                  value={personalRoomName}
                  onChange={(e) => setPersonalRoomName(e.target.value)}
                  placeholder="默认：好友聊天室"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择好友</label>
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.friendId}
                      onClick={() => toggleFriend(friend.friendId)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                        selectedFriends.includes(friend.friendId)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-gray-500">{friend.nickname.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{friend.nickname}</div>
                        <div className="text-xs text-gray-400">{friend.phone}</div>
                      </div>
                      {selectedFriends.includes(friend.friendId) && (
                        <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreatePersonalRoom}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-bold"
              >
                创建聊天室
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 关闭聊天室确认弹窗 */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCloseConfirm(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">确认关闭聊天室？</h3>
              <p className="text-sm text-gray-500 mb-4">关闭后所有成员将无法进入该聊天室，此操作不可撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseConfirm(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600"
                >
                  取消
                </button>
                <button
                  onClick={() => handleCloseRoom(showCloseConfirm)}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold"
                >
                  确认关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoomListPage;

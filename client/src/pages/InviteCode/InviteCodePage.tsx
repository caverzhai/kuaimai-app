import { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@/contexts/AuthContext';
import { getInviteInfo as apiGetInviteInfo } from '../../api';
import type { InviteInfo, InviteRecordInfo } from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS } from '@shared/api.interface';
import {
  Copy,
  Check,
  Share2,
  UserPlus,
  Users,
  Lock,
  Loader2,
  RefreshCw,
  User,
  Link2,
  QrCode,
  Download,
} from 'lucide-react';
import { Image } from '@client/src/components/ui/image';
import { useNavigate } from 'react-router-dom';

export default function InviteCodePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Generate invite link and QR code
  const inviteLink = data?.inviteCode
    ? `https://backend-production-5d79.up.railway.app/register?inviteCode=${data.inviteCode}`
    : '';
  const qrCodeUrl = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=10&data=${encodeURIComponent(inviteLink)}`
    : '';

  useEffect(() => {
    if (authLoading || !user) return;
    // 只有4级及以上咨询师才调用邀请码接口
    if (LEVEL_LAYERS[user.level] >= 4) {
      fetchData();
    }
  }, [authLoading, user]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetInviteInfo();
      setData(result as InviteInfo);
    } catch (err) {
      logger.error('获取邀请信息失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!data?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(data.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('复制邀请码失败', err);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      logger.error('复制邀请链接失败', err);
    }
  }

  const canSeeInviteCode = user && LEVEL_LAYERS[user.level] >= 4;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <UserPlus className="h-10 w-10 text-orange-500" />
        <p className="text-gray-600">请登录后查看邀请码</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          去登录
        </button>
      </div>
    );
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-destructive">{error}</div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* 邀请码卡片 */}
      {canSeeInviteCode && data?.inviteCode ? (
        <div className="bg-gradient-to-br from-orange-500 to-orange-400 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">
                我的专属邀请码
              </span>
            </div>
            <div className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {LEVEL_NAMES[user.level] || user.level}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-2xl font-bold tracking-widest flex-1">
              {data.inviteCode}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-white text-orange-500 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  复制
                </>
              )}
            </button>
          </div>

          <p className="text-xs opacity-80 mt-4">
            分享邀请码给好友，好友注册后将成为您的直推成员
          </p>

          {/* 邀请链接 */}
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4" />
              <span className="text-xs font-medium opacity-90">邀请链接</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs bg-white/20 px-3 py-2 rounded-lg truncate">
                {inviteLink}
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 bg-white text-orange-500 px-3 py-2 rounded-lg font-medium text-xs hover:bg-orange-50 transition-colors flex-shrink-0"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3 w-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    复制
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 二维码 */}
          <div className="mt-4 bg-white rounded-xl p-4 flex items-center gap-4">
            <div className="w-28 h-28 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="邀请二维码"
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="h-10 w-10 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-900">邀请二维码</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                好友扫码即可注册加入您的团队
              </p>
              <a
                href={qrCodeUrl}
                download="kuaimai-invite-qrcode.png"
                className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600"
              >
                <Download className="h-3 w-3" />
                保存二维码
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            升级到4级咨询师解锁邀请码
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            当前等级：{LEVEL_NAMES[user.level] || user.level}
            <br />
            升级到4级咨询师后即可生成专属邀请码，邀请好友加入团队
          </p>
        </div>
      )}

      {/* 邀请记录 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            邀请记录
          </h2>
          {data && (
            <span className="text-sm text-gray-500">
              共 <span className="font-semibold text-orange-500">
                {data.total}
              </span>{' '}
              人
            </span>
          )}
        </div>

        {!canSeeInviteCode ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            升级到4级咨询师后可查看邀请记录
          </div>
        ) : data?.records && data.records.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {data.records.map((record: InviteRecordInfo) => {
              const invitee = record.invitee;
              const levelName = invitee
                ? LEVEL_NAMES[invitee.level] || invitee.level
                : '';

              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* 头像 */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {invitee?.avatarUrl ? (
                      <Image
                        src={invitee.avatarUrl}
                        alt={invitee.nickname}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-orange-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {invitee?.nickname || '未知用户'}
                      </span>
                      <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-px rounded flex-shrink-0">
                        {levelName}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {invitee?.phone || ''}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(record.registeredAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无邀请记录</p>
            <p className="text-xs mt-1">分享您的邀请码给好友吧</p>
          </div>
        )}
      </div>

      {/* 分享提示 */}
      {canSeeInviteCode && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <div className="text-sm font-medium text-orange-800 mb-1 flex items-center gap-1">
            <Share2 className="h-4 w-4" />
            分享提示
          </div>
          <p className="text-xs text-orange-700 leading-relaxed">
            复制您的专属邀请码，分享给有需要的朋友。
            朋友通过您的邀请码注册后，将自动加入您的团队，
            您可以获得相应的推荐奖励和团队收益。
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Phone,
  MapPin,
  Briefcase,
  Award,
  FileText,
  QrCode,
  Building2,
  LogOut,
  Edit3,
  Check,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download,
  Settings,
  Camera,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { updateProfile } from '@client/src/api';
import type { UpdateProfileDTO } from '@shared/api.interface';
import { LEVEL_NAMES } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { FieldRow, ImageFieldRow } from '@client/src/components/ProfileFieldRow';
import { RegionSelector } from '@client/src/components/RegionSelector';
import { APP_VERSION, checkUpdate, downloadAndInstall, type VersionInfo } from '@client/src/utils/version';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 头像上传处理
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError('');
    setSuccess('');
    try {
      console.log('[AvatarUpload] 开始上传头像', file.name, file.size);
      
      // 先读取文件为 base64
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });
      console.log('[AvatarUpload] 文件读取成功，base64长度:', fileBase64.length);

      // 尝试压缩图片（带超时保护，避免在某些WebView中永远pending）
      let compressed = fileBase64;
      try {
        // 检查 Image 构造函数是否可用，不可用则直接使用原始图片
        if (typeof Image === 'undefined' || typeof document === 'undefined') {
          console.log('[AvatarUpload] Image或document不可用，跳过压缩');
          compressed = fileBase64;
        } else {
          compressed = await Promise.race([
            new Promise<string>((resolve, reject) => {
              try {
                const img = document.createElement('img'); // 使用 createElement 代替 new Image()
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const maxSize = 300;
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                      const ratio = Math.min(maxSize / width, maxSize / height);
                      width = Math.round(width * ratio);
                      height = Math.round(height * ratio);
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                      resolve(fileBase64); // 降级使用原始图片
                      return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                  } catch (err) {
                    resolve(fileBase64); // 降级使用原始图片
                  }
                };
                img.onerror = () => resolve(fileBase64); // 降级使用原始图片
                img.src = fileBase64;
              } catch (err) {
                console.log('[AvatarUpload] 创建图片元素失败，使用原始图片', err);
                resolve(fileBase64);
              }
            }),
            new Promise<string>((resolve) => {
              setTimeout(() => {
                console.log('[AvatarUpload] 图片压缩超时，使用原始图片');
                resolve(fileBase64);
              }, 5000); // 5秒超时
            }),
          ]);
          console.log('[AvatarUpload] 图片压缩完成，base64长度:', compressed.length);
        }
      } catch (err) {
        console.log('[AvatarUpload] 图片压缩失败，使用原始图片', err);
        compressed = fileBase64;
      }

      // 上传到服务器（带超时保护）
      console.log('[AvatarUpload] 开始上传到服务器');
      const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');
      
      const uploadPromise = axiosForBackend.post('/api/upload/image', { base64: compressed });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('上传超时')), 30000); // 30秒超时
      });
      
      const response = await Promise.race([uploadPromise, timeoutPromise]) as { data: { success: boolean; url: string; message?: string } };
      
      console.log('[AvatarUpload] 服务器响应:', response.data);
      
      if (response.data.success) {
        // 更新表单中的头像URL
        setForm((prev) => ({ ...prev, avatarUrl: response.data.url }));
        setSuccess('头像上传成功，点击保存生效');
        setTimeout(() => setSuccess(''), 3000);
        console.log('[AvatarUpload] 头像上传成功');
      } else {
        throw new Error(response.data.message || '上传失败');
      }
    } catch (err) {
      console.error('[AvatarUpload] 头像上传失败', err);
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`头像上传失败: ${errorMsg}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setError('');
    try {
      const info = await checkUpdate();
      if (info) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        setSuccess('当前已是最新版本');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('检查更新失败，请稍后重试');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const [form, setForm] = useState<UpdateProfileDTO>({
    nickname: '',
    avatarUrl: '',
    gender: '',
    age: undefined,
    receiveAddress: '',
    receivePhone: '',
    industry: '',
    qualification: '',
    serviceStandard: '',
    wechatQrcodeUrl: '',
    alipayQrcodeUrl: '',
    companyQrcodeUrl: '',
    businessLicenseUrl: '',
    idCardFrontUrl: '',
    idCardBackUrl: '',
    realName: '',
    wechatId: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || '',
        gender: user.gender || '',
        age: user.age,
        receiveAddress: user.receiveAddress || '',
        receivePhone: user.receivePhone || '',
        industry: user.industry || '',
        qualification: user.qualification || '',
        serviceStandard: user.serviceStandard || '',
        wechatQrcodeUrl: user.wechatQrcodeUrl || '',
        alipayQrcodeUrl: user.alipayQrcodeUrl || '',
        companyQrcodeUrl: user.companyQrcodeUrl || '',
        businessLicenseUrl: user.businessLicenseUrl || '',
        idCardFrontUrl: user.idCardFrontUrl || '',
        idCardBackUrl: user.idCardBackUrl || '',
        realName: user.realName || '',
        wechatId: user.wechatId || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await updateProfile(form as Record<string, unknown>);
      await refreshUser();
      setEditing(false);
      setSuccess('资料更新成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      logger.error('更新资料失败', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || '更新失败，请稍后重试'
          : '更新失败，请稍后重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showConsultant = user && user.level !== 'junior';
  const showLevel7 =
    user && (user.level === 'level_7' || user.level === 'level_8');

  // 辅助函数：生成字段的 onChange 处理函数
  const handleFieldChange = (field: keyof UpdateProfileDTO) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <User className="h-10 w-10 text-orange-500" />
        <p className="text-gray-600">请登录后查看个人中心</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          去登录
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
        <button
          onClick={() => (editing ? handleSave() : setEditing(true))}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {editing ? (
            <>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              保存
            </>
          ) : (
            <>
              <Edit3 size={16} />
              编辑资料
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-start gap-2">
          <Check size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden cursor-pointer relative group"
            onClick={() => editing && !uploadingAvatar && avatarInputRef.current?.click()}
          >
            {uploadingAvatar ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-white" />
              </div>
            ) : editing ? (form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt={user.nickname}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[AvatarPreview] 图片加载失败:', form.avatarUrl, e);
                }}
                onLoad={() => {
                  console.log('[AvatarPreview] 图片加载成功:', form.avatarUrl);
                }}
              />
            ) : (
              <User size={30} />
            )) : (user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.nickname}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[Avatar] 图片加载失败:', user.avatarUrl, e);
                }}
              />
            ) : (
              <User size={30} />
            ))}
            {editing && !uploadingAvatar && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} />
              </div>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{user.nickname}</h2>
            <p className="mt-0.5 text-sm text-white/80 flex items-center gap-1">
              <Phone size={12} />
              {user.phone}
            </p>
            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium">
              {user.level}
            </div>
            {editing && (
              <p className="mt-1 text-xs text-white/70">点击头像可更换</p>
            )}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <User size={18} className="text-orange-500" />
          基本资料
        </h3>
        <FieldRow
          icon={User}
          label="昵称"
          value={form.nickname || ''}
          editing={editing} onChange={handleFieldChange('nickname')}
        />
        <FieldRow
          icon={User}
          label="性别"
          value={form.gender || ''}
          editing={editing} onChange={handleFieldChange('gender')}
          options={[
            { value: '男', label: '男' },
            { value: '女', label: '女' },
          ]}
        />
        <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-b-0">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
            <Phone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">手机号</p>
            <p className="text-sm text-gray-900">{user.phone}</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <MapPin size={18} className="text-orange-500" />
          收货信息
        </h3>
        {editing ? (
          <div className="py-3 border-b border-gray-50">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
                <MapPin size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-2">所在地区</p>
                <RegionSelector
                  value={form.receiveAddress?.split(' ')[0] || ''}
                  onChange={(region) => {
                    const detail = form.receiveAddress?.split(' ').slice(1).join(' ') || '';
                    setForm((prev) => ({
                      ...prev,
                      receiveAddress: region ? `${region} ${detail}`.trim() : detail,
                    }));
                  }}
                />
                <p className="text-xs text-gray-500 mt-3 mb-1">详细地址</p>
                <input
                  type="text"
                  value={form.receiveAddress?.split(' ').slice(1).join(' ') || ''}
                  onChange={(e) => {
                    const region = form.receiveAddress?.split(' ')[0] || '';
                    setForm((prev) => ({
                      ...prev,
                      receiveAddress: region ? `${region} ${e.target.value}`.trim() : e.target.value,
                    }));
                  }}
                  placeholder="请输入详细地址（街道、门牌号等）"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
          </div>
        ) : (
          <FieldRow
            icon={MapPin}
            label="收货地址"
            value={form.receiveAddress || ''}
            field="receiveAddress"
            textarea
          />
        )}
        <FieldRow
          icon={Phone}
          label="联系电话"
          value={form.receivePhone || ''}
          editing={editing} onChange={handleFieldChange('receivePhone')}
          maxLength={11}
          numericOnly={true}
          placeholder="请输入11位手机号"
        />
      </section>

      {/* 咨询师资料 - 所有人都需要填写 */}
      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Briefcase size={18} className="text-orange-500" />
          咨询师资料
        </h3>
        {/* 等级 - 自动显示，不可编辑 */}
        <div className="flex items-start gap-3 py-3 border-b border-gray-50">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
            <Award size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">咨询师等级（自动生成）</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
              {LEVEL_NAMES[user.level] || '初级'}
            </span>
            <p className="text-xs text-gray-400 mt-1">等级根据完成升级任务自动提升</p>
          </div>
        </div>
        {/* 年龄 */}
        {editing ? (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">年龄</p>
              <input
                type="number"
                value={form.age || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="请输入年龄"
                min="1"
                max="120"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        ) : (
          <FieldRow
            icon={User}
            label="年龄"
            value={form.age ? `${form.age}岁` : ''}
          />
        )}
        {/* 行业 - 固定选择 */}
        {editing ? (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <Briefcase size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">行业</p>
              <select
                value={form.industry || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-white"
              >
                <option value="">请选择行业</option>
                <option value="心理">心理</option>
                <option value="教育">教育</option>
                <option value="生产">生产</option>
                <option value="管理">管理</option>
                <option value="认知">认知</option>
                <option value="其它">其它</option>
              </select>
            </div>
          </div>
        ) : (
          <FieldRow
            icon={Briefcase}
            label="行业"
            value={form.industry || ''}
          />
        )}
        <FieldRow
          icon={Award}
          label="资质证明"
          value={form.qualification || ''}
          editing={editing} onChange={handleFieldChange('qualification')}
          textarea
          placeholder="例如：国家二级心理咨询师、注册会计师、高级工程师等，填写您的专业资质证书名称和编号"
        />
        <FieldRow
          icon={FileText}
          label="服务标准"
          value={form.serviceStandard || ''}
          editing={editing} onChange={handleFieldChange('serviceStandard')}
          textarea
          placeholder="例如：1. 提供1对1咨询服务 2. 24小时内回复 3. 服务不满意可退款 4. 保密承诺等"
        />
      </section>

      {/* 实名认证 section */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-orange-500" />
          实名认证 <span className="text-red-500 text-xs">*必传</span>
        </h3>
        <FieldRow
          icon={User}
          label="真实姓名"
          value={form.realName || ''}
          editing={editing} onChange={handleFieldChange('realName')}
          placeholder="请输入身份证上的真实姓名"
        />
        <FieldRow
          icon={MessageCircle}
          label="微信号"
          value={form.wechatId || ''}
          editing={editing} onChange={handleFieldChange('wechatId')}
          placeholder="选填，方便联系"
        />
        <ImageFieldRow
          icon={CreditCard}
          label="身份证正面"
          value={form.idCardFrontUrl || ''}
          editing={editing} onChange={handleFieldChange('idCardFrontUrl')}
          required
        />
        <ImageFieldRow
          icon={CreditCard}
          label="身份证反面"
          value={form.idCardBackUrl || ''}
          editing={editing} onChange={handleFieldChange('idCardBackUrl')}
          required
        />
        <p className="text-xs text-gray-400 mt-2">
          身份证信息仅用于平台实名认证，不会公开显示，请放心上传
        </p>
      </section>

      {/* 收款码 section */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-orange-500" />
          收款码
        </h3>
        <ImageFieldRow
          icon={QrCode}
          label="微信收款码"
          value={form.wechatQrcodeUrl || ''}
          editing={editing} onChange={handleFieldChange('wechatQrcodeUrl')}
        />
        <ImageFieldRow
          icon={QrCode}
          label="支付宝收款码"
          value={form.alipayQrcodeUrl || ''}
          editing={editing} onChange={handleFieldChange('alipayQrcodeUrl')}
        />
      </section>

      {showLevel7 && (
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Building2 size={18} className="text-orange-500" />
            7级资质
          </h3>
          <ImageFieldRow
            icon={Building2}
            label="公司收款码"
            value={form.companyQrcodeUrl || ''}
            editing={editing} onChange={handleFieldChange('companyQrcodeUrl')}
          />
          <ImageFieldRow
            icon={FileText}
            label="营业执照"
            value={form.businessLicenseUrl || ''}
            editing={editing} onChange={handleFieldChange('businessLicenseUrl')}
          />
          <div className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <Award size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">审核状态</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.companyAuditStatus === 'approved'
                    ? 'bg-green-50 text-green-600'
                    : user.companyAuditStatus === 'rejected'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-yellow-50 text-yellow-600'
                }`}
              >
                {user.companyAuditStatus === 'approved'
                  ? '已通过'
                  : user.companyAuditStatus === 'rejected'
                    ? '已拒绝'
                    : '审核中'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 邀请码入口 */}
      <button
        onClick={() => navigate('/invite')}
        className="w-full py-3 bg-white border border-orange-100 text-orange-500 font-medium rounded-2xl shadow-sm hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 mb-3"
      >
        <QrCode size={18} />
        我的邀请码（分享给好友）
      </button>

      <button
        onClick={handleLogout}
        className="w-full py-3 bg-white border border-red-100 text-red-500 font-medium rounded-2xl shadow-sm hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-2"
      >
        <LogOut size={18} />
        退出登录
      </button>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
              <RefreshCw size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">检查更新</p>
              <p className="text-xs text-gray-500">当前版本 v{APP_VERSION}</p>
            </div>
          </div>
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5"
          >
            {checkingUpdate ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                检查中
              </>
            ) : (
              '检查更新'
            )}
          </button>
        </div>
      </div>

      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Download size={28} className="text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">发现新版本</h3>
              <p className="text-sm text-gray-500 mt-1">v{updateInfo.version}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">更新内容：</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{updateInfo.releaseNotes}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                稍后
              </button>
              <button
                onClick={() => {
                  if (updateInfo) {
                    const success = downloadAndInstall(updateInfo);
                    if (success) {
                      setShowUpdateModal(false);
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors text-center inline-flex items-center justify-center gap-1.5"
              >
                <Download size={16} />
                立即更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

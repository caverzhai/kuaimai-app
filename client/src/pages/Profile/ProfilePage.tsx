import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Phone,
  MapPin,
  Briefcase,
  Award,
  FileText,
  QrCode,
  Wallet,
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
  Users,
  ChevronDown,
  Apple,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { updateProfile, getRelationTree, recognizeIdCard, changePassword } from '@client/src/api';
import { getCache, setCache } from '@client/src/utils/cache';
import { PullToRefresh } from '@client/src/components/ui/PullToRefresh';
import type { UpdateProfileDTO } from '@shared/api.interface';
import { LEVEL_NAMES, LEVEL_LAYERS } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { FieldRow, ImageFieldRow } from '@client/src/components/ProfileFieldRow';
import { AssessmentCard } from '@client/src/components/AssessmentCard';
import { APP_VERSION, checkUpdate, downloadAndInstall, forceDownloadLatest, type VersionInfo } from '@client/src/utils/version';
import { getErrorMessage } from '@client/src/utils/errorMessage';
import { isValidNickname, NICKNAME_RULE_HINT } from '@shared/validation';

const ProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, refreshUser, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  // 从注册/任务中心（OnboardingGuide）跳入时，路由 state.autoEdit=true，直接进入资料编辑态，无需再点"编辑资料"
  const autoEditTried = useRef(false);
  useEffect(() => {
    if ((location.state as { autoEdit?: boolean } | null)?.autoEdit && !autoEditTried.current) {
      autoEditTried.current = true;
      setEditing(true);
    }
  }, [location.state]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const isH5 = !(window as any).Capacitor && !window.AppUpdate;
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrOk, setOcrOk] = useState(true);
  // 关系树数据 - 使用lazy initial state，立即从缓存显示
  const [relationTree, setRelationTree] = useState<any>(() => {
    try {
      const cachedUserStr = localStorage.getItem('kuaimai_user_cache');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser.id) {
          const cached = getCache(`relation_tree_${cachedUser.id}`, true);
          return cached || null;
        }
      }
    } catch (e) {
      // 忽略
    }
    return null;
  });
  const [relationTreeLoading, setRelationTreeLoading] = useState(false);
  const [idCardExpanded, setIdCardExpanded] = useState(true);
  const [relationTreeExpanded, setRelationTreeExpanded] = useState(false);
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
      setError(getErrorMessage(err, '上传头像'));
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
      setError(getErrorMessage(err, '检查更新'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  // 固定位置"下载最新版·覆盖安装"：不比较版本，直接下载最新 APK 并唤起覆盖安装
  const [forceDownloading, setForceDownloading] = useState(false);

  // 修改密码弹窗
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdModalError, setPwdModalError] = useState('');

  const resetPasswordForm = () => {
    setPwdOld('');
    setPwdNew('');
    setPwdConfirm('');
    setPwdModalError('');
  };

  const handleChangePassword = async () => {
    setPwdModalError('');
    const oldPwd = pwdOld;
    const newPwd = pwdNew.trim();
    if (!oldPwd || !newPwd || !pwdConfirm.trim()) {
      setPwdModalError('请填写完整：旧密码、新密码、确认新密码');
      return;
    }
    if (newPwd.length < 6) {
      setPwdModalError('新密码长度至少6位');
      return;
    }
    if (newPwd !== pwdConfirm.trim()) {
      setPwdModalError('两次输入的新密码不一致，请重新确认');
      return;
    }
    if (newPwd === oldPwd || newPwd === oldPwd.trim()) {
      setPwdModalError('新密码不能与旧密码相同，请设置不同的新密码');
      return;
    }
    setChangingPwd(true);
    try {
      await changePassword(oldPwd, newPwd);
      setShowPasswordModal(false);
      resetPasswordForm();
      setSuccess('密码修改成功，下次登录请使用新密码');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setPwdModalError(getErrorMessage(err, '修改密码'));
    } finally {
      setChangingPwd(false);
    }
  };

  const handleForceDownload = async () => {
    setForceDownloading(true);
    setError('');
    setSuccess('');
    try {
      const ok = await forceDownloadLatest();
      if (ok) {
        setSuccess('已开始下载最新版，下载完成后请点击安装包覆盖安装（无需卸载旧版）');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('下载未能启动，请检查网络后重试；若仍失败，请用浏览器访问下载链接手动下载');
      }
    } catch (err) {
      setError(getErrorMessage(err, '下载最新版'));
    } finally {
      setForceDownloading(false);
    }
  };

  const [form, setForm] = useState<UpdateProfileDTO>({
    nickname: '',
    avatarUrl: '',
    gender: '',
    age: undefined,
    industry: '',
    qualification: '',
    serviceStandard: '',
    wechatQrcodeUrl: '',
    alipayQrcodeUrl: '',
    companyQrcodeUrl: '',
    businessLicenseUrl: '',
    idCardFrontUrl: '',
    idCardBackUrl: '',
    idCardNumber: '',
    realName: '',
    address: '',
    wechatId: '',
  });

  useEffect(() => {
    // 编辑模式下不重置表单，防止用户正在编辑时被意外清空
    if (user && !editing) {
      setForm({
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || '',
        gender: user.gender || '',
        age: user.age,
        industry: user.industry || '',
        qualification: user.qualification || '',
        serviceStandard: user.serviceStandard || '',
        wechatQrcodeUrl: user.wechatQrcodeUrl || '',
        alipayQrcodeUrl: user.alipayQrcodeUrl || '',
        companyQrcodeUrl: user.companyQrcodeUrl || '',
        businessLicenseUrl: user.businessLicenseUrl || '',
        idCardFrontUrl: user.idCardFrontUrl || '',
        idCardBackUrl: user.idCardBackUrl || '',
        idCardNumber: user.idCardNumber || '',
        realName: user.realName || '',
        address: user.address || '',
        wechatId: user.wechatId || '',
      });
    }
  }, [user, editing]);

  // 获取关系树数据（silent=true 时不显示loading、不打断旧内容）
  const fetchRelationTree = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setRelationTreeLoading(true);
    try {
      const data = await getRelationTree();
      setRelationTree(data);
      setCache(`relation_tree_${user.id}`, data);
    } catch (err) {
      logger.error('获取关系树失败', err);
    } finally {
      setRelationTreeLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // 缓存优先：有旧内容直接显示、不自动请求（不打断）；无缓存首次才请求
    const cached = getCache(`relation_tree_${user.id}`, true);
    if (cached) {
      setRelationTree(cached);
    } else {
      fetchRelationTree();
    }
  }, [user, fetchRelationTree]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (form.nickname !== undefined && form.nickname.trim() && !isValidNickname(form.nickname.trim())) {
      setError(NICKNAME_RULE_HINT);
      return;
    }
    setLoading(true);
    try {
      // 保存资料，API会返回更新后的完整用户信息
      const updatedUser = await updateProfile(form as Record<string, unknown>);
      // 直接用API返回的最新数据更新用户状态，避免额外的refreshUser请求可能带来的问题
      if (updatedUser) {
        updateUser(updatedUser as UserInfo);
      } else {
        // 兜底：如果API没有返回用户信息，再调用refreshUser
        await refreshUser();
      }
      setEditing(false);
      setSuccess('资料更新成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      logger.error('更新资料失败', err);
      setError(getErrorMessage(err, '保存个人资料'));
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
    user && (user.level === 'level_7' || user.level === 'level_8' || user.level === 'level_9');

  // 辅助函数：生成字段的 onChange 处理函数
  const handleFieldChange = (field: keyof UpdateProfileDTO) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 身份证正面上传：仅保存照片，不再联网OCR识别
  const handleIdCardFrontChange = (value: string) => {
    if (value && value.startsWith('http')) {
      setForm((prev) => ({ ...prev, idCardFrontUrl: value }));
      setOcrOk(true);
      setOcrMessage('照片上传成功');
      setTimeout(() => setOcrMessage(''), 2000);
    } else {
      setForm((prev) => ({ ...prev, idCardFrontUrl: value }));
    }
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
    <PullToRefresh onRefresh={() => fetchRelationTree(true)}>
    <div className={`max-w-3xl mx-auto space-y-6 ${editing ? 'pb-32' : ''}`}>
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

      <AssessmentCard />

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

      {/* 实名认证 section - 上传身份证后自动填充所有信息 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <button onClick={() => setIdCardExpanded(!idCardExpanded)} className="w-full flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-500" />
            实名认证 <span className="text-red-500 text-xs">*必传</span>
          </h3>
          <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${idCardExpanded ? "rotate-180" : ""}`} />
        </button>

        <div className={idCardExpanded ? "" : "hidden"}>
        {/* 身份证上传 - 放在最前面，上传后自动填充 */}
        <ImageFieldRow
          icon={CreditCard}
          label="身份证正面"
          value={form.idCardFrontUrl || ''}
          editing={editing} onChange={handleIdCardFrontChange}
          required
        />

        {/* OCR识别状态提示 */}
        {ocrLoading && (
          <div className="flex items-center gap-2 mt-2 mb-3 text-sm text-orange-600">
            <Loader2 size={16} className="animate-spin" />
            <span>{ocrMessage}</span>
          </div>
        )}
        {!ocrLoading && ocrMessage && (
          <div className={`text-sm mt-2 mb-3 ${ocrOk ? 'text-green-600' : 'text-red-600'}`}>{ocrMessage}</div>
        )}

        {/* 上传提示 */}
        {editing && !form.idCardFrontUrl && (
          <p className="text-xs text-orange-500 mb-3">上传身份证正面后，系统将自动识别并填充姓名、性别、身份证号、地址</p>
        )}

        {/* 自动填充的信息字段 */}
        <FieldRow
          icon={User}
          label="真实姓名"
          value={form.realName || ''}
          editing={editing} onChange={handleFieldChange('realName')}
          placeholder="上传身份证后自动填充"
        />

        {/* 性别 - 只能选择男女 */}
        {editing ? (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1.5">性别</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, gender: '男' }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.gender === '男' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  男
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, gender: '女' }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.gender === '女' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  女
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">性别</p>
              <p className="text-sm text-gray-900">{form.gender || '未填写'}</p>
            </div>
          </div>
        )}

        {/* 身份证号 */}
        {editing && (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <CreditCard size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1.5">身份证号码 <span className="text-red-500">*</span></p>
              <input
                type="text"
                value={form.idCardNumber || ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setForm(prev => ({ ...prev, idCardNumber: val }));
                  if (/^\d{17}[\dX]$/.test(val)) {
                    const genderDigit = parseInt(val.charAt(16), 10);
                    if (!isNaN(genderDigit)) {
                      setForm(prev => ({ ...prev, gender: genderDigit % 2 === 1 ? '男' : '女' }));
                    }
                  }
                }}
                placeholder="上传身份证后自动填充"
                maxLength={18}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        )}
        {!editing && form.idCardNumber && (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
              <CreditCard size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">身份证号码</p>
              <p className="text-sm font-medium text-gray-900">
                {form.idCardNumber.substring(0, 6)}********{form.idCardNumber.substring(14)}
              </p>
            </div>
          </div>
        )}

        {/* 地址 - 上传身份证后自动填充 */}
        <FieldRow
          icon={MapPin}
          label="户籍地址"
          value={form.address || ''}
          editing={editing} onChange={handleFieldChange('address')}
          placeholder="上传身份证后自动填充"
          textarea
        />

        <FieldRow
          icon={MessageCircle}
          label="微信号"
          value={form.wechatId || ''}
          editing={editing} onChange={handleFieldChange('wechatId')}
          placeholder="选填，方便联系"
        />

        <p className="text-xs text-gray-400 mt-2">
          身份证信息仅用于平台实名认证，不会公开显示，请放心上传
        </p>
        </div>
      </section>

      {/* 关系树 */}
      <section className="bg-white rounded-2xl shadow-sm p-6">
        <button onClick={() => setRelationTreeExpanded(!relationTreeExpanded)} className="w-full flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            我的关系树
          </h3>
          <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${relationTreeExpanded ? "rotate-180" : ""}`} />
        </button>
        <div className={relationTreeExpanded ? "" : "hidden"}>
        {relationTreeLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-orange-500" />
            <span className="ml-2 text-sm text-gray-500">加载中...</span>
          </div>
        ) : relationTree ? (
          <div className="space-y-4">
            {/* ===== 上级关系 ===== */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase">上级关系</p>
              <div className="space-y-2">
                {/* 直接邀请人 */}
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                    邀
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">我的直接邀请人</p>
                    {relationTree.directInviter ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{relationTree.directInviter.nickname}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">{LEVEL_NAMES[relationTree.directInviter.level as keyof typeof LEVEL_NAMES] || relationTree.directInviter.level}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">无</p>
                    )}
                  </div>
                </div>

                {/* 直接上级咨询师 */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    上
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">我的直接上级咨询师（上一代）</p>
                    {relationTree.directParent ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{relationTree.directParent.nickname}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">{LEVEL_NAMES[relationTree.directParent.level as keyof typeof LEVEL_NAMES] || relationTree.directParent.level}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">无</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== 下级关系 ===== */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase">下级关系</p>
              <div className="space-y-2">
                {/* 直推区待定（已邀请但未完成4级任务，未进入团队树） */}
                <div className="p-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0">
                      待
                    </div>
                    <p className="text-xs text-gray-500">直推区待定（{relationTree.pendingDirectInvites?.length || 0}人，完成4级任务后自动进入团队树）</p>
                  </div>
                  {relationTree.pendingDirectInvites && relationTree.pendingDirectInvites.length > 0 ? (
                    <div className="space-y-1.5 ml-10">
                      {relationTree.pendingDirectInvites.map((child: any) => (
                        <div key={child.id} className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{child.nickname}</p>
                          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded">待升级</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 ml-10">暂无待定用户</p>
                  )}
                </div>

                {/* 下级代（1-9代：1-5代显示姓名，6-9代只显示人数） */}
                {(() => {
                  const gens = relationTree.descendantGenerations && relationTree.descendantGenerations.length > 0
                    ? relationTree.descendantGenerations
                    : [
                        { generation: 1, count: relationTree.directChildren?.length || 0, users: relationTree.directChildren || [] },
                        { generation: 2, count: relationTree.secondGenerationChildren?.length || 0, users: relationTree.secondGenerationChildren || [] },
                        { generation: 3, count: relationTree.thirdGenerationChildren?.length || 0, users: relationTree.thirdGenerationChildren || [] },
                      ];
                  const colorSets = [
                    { bg: 'bg-teal-50', badge: 'bg-teal-200 text-teal-700', tag: 'bg-teal-100 text-teal-600' },
                    { bg: 'bg-green-50', badge: 'bg-green-200 text-green-700', tag: 'bg-green-100 text-green-600' },
                    { bg: 'bg-purple-50', badge: 'bg-purple-200 text-purple-700', tag: 'bg-purple-100 text-purple-600' },
                    { bg: 'bg-indigo-50', badge: 'bg-indigo-200 text-indigo-700', tag: 'bg-indigo-100 text-indigo-600' },
                    { bg: 'bg-pink-50', badge: 'bg-pink-200 text-pink-700', tag: 'bg-pink-100 text-pink-600' },
                    { bg: 'bg-orange-50', badge: 'bg-orange-200 text-orange-700', tag: 'bg-orange-100 text-orange-600' },
                    { bg: 'bg-cyan-50', badge: 'bg-cyan-200 text-cyan-700', tag: 'bg-cyan-100 text-cyan-600' },
                    { bg: 'bg-rose-50', badge: 'bg-rose-200 text-rose-700', tag: 'bg-rose-100 text-rose-600' },
                    { bg: 'bg-lime-50', badge: 'bg-lime-200 text-lime-700', tag: 'bg-lime-100 text-lime-600' },
                  ];
                  const genLabels = ['直接下一代', '下二代', '下三代', '下四代', '下五代', '下六代', '下七代', '下八代', '下九代', '下十代', '下十一代', '下十二代', '下十三代', '下十四代', '下十五代'];
                  return gens.filter((g: any) => g.count > 0 && g.generation <= 9).map((g: any) => {
                    const c = colorSets[(g.generation - 1) % colorSets.length];
                    const showNames = g.generation <= 5;
                    return (
                      <div key={g.generation} className={`p-3 ${c.bg} rounded-xl`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-full ${c.badge} flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                            下{g.generation}
                          </div>
                          <p className="text-xs text-gray-500">我的{genLabels[g.generation - 1]}咨询师（{g.count}人）</p>
                        </div>
                        {showNames ? (
                          g.users.length > 0 ? (
                            <div className="space-y-1.5 ml-10">
                              {g.users.map((child: any) => (
                                <div key={child.id} className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{child.nickname}</p>
                                  <span className={`text-xs px-1.5 py-0.5 ${c.tag} rounded`}>{LEVEL_NAMES[child.level as keyof typeof LEVEL_NAMES] || child.level}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 ml-10">无</p>
                          )
                        ) : (
                          <p className="text-sm text-gray-400 ml-10">共 {g.count} 人（仅显示人数）</p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">暂无关系树数据</p>
        )}
        </div>
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

      {/* 我的邀请人 */}
      {user.inviterId && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <User size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">我的邀请人</p>
              <p className="text-sm font-medium text-gray-900">
                {user.inviterNickname || '未知'}
                {user.inviterPhone && (
                  <span className="text-gray-500 ml-2">{user.inviterPhone}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 邀请码入口 */}
      <button
        onClick={() => navigate('/invite')}
        className="w-full py-3 bg-white border border-orange-100 text-orange-500 font-medium rounded-2xl shadow-sm hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 mb-3"
      >
        <QrCode size={18} />
        我的邀请码（分享给好友）
      </button>

      {/* 我的资金入口 */}
      <button
        onClick={() => navigate('/finance')}
        className="w-full py-3 bg-white border border-orange-100 text-orange-500 font-medium rounded-2xl shadow-sm hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 mb-3"
      >
        <Wallet size={18} />
        我的资金（收入与流失明细）
      </button>

      {/* 修改密码入口 */}
      <button
        onClick={() => { resetPasswordForm(); setShowPasswordModal(true); }}
        className="w-full py-3 bg-white border border-orange-100 text-orange-500 font-medium rounded-2xl shadow-sm hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 mb-3"
      >
        <Settings size={18} />
        修改密码
      </button>

      {/* 苹果手机 App 独立安装申请（4级及以上） */}
      {LEVEL_LAYERS[user.level] >= 4 && (
        <button
          onClick={() => navigate('/ios-install')}
          className="w-full py-3 bg-white border border-orange-100 text-orange-500 font-medium rounded-2xl shadow-sm hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2 mb-3"
        >
          <Apple size={18} />
          苹果手机 App 独立安装申请
        </button>
      )}

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
              <p className="text-xs text-gray-500">当前Powered by WebShark Tech | www.webshark.tech<br/>版本 v{APP_VERSION}</p>
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

        {/* 固定位置：下载最新版·覆盖安装（点击即下载最新版、直接覆盖安装，不依赖更新通知） */}
        <button
          onClick={handleForceDownload}
          disabled={forceDownloading}
          className="mt-4 w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-sm"
        >
          {forceDownloading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              正在准备下载…
            </>
          ) : (
            <>
              <Download size={18} />
              下载最新版 · 覆盖安装
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-gray-400 text-center">点击即下载最新版安装包，安装时直接覆盖旧版、无需卸载</p>
      </div>

      {/* H5（浏览器）环境提供 APP 下载入口 */}
      {isH5 && (
        <a
          href="https://backend-production-5d79.up.railway.app/download/kuaimai.apk"
          className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-center gap-2 text-orange-500 font-medium border border-orange-100 hover:bg-orange-50 transition-colors"
        >
          <Download size={18} />
          下载 AI快卖 APP（安卓安装包）
        </a>
      )}

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

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">修改密码</h3>
              <button
                onClick={() => { setShowPasswordModal(false); resetPasswordForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {pwdModalError && (
              <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 mb-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{pwdModalError}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">旧密码</p>
                <input
                  type="password"
                  value={pwdOld}
                  onChange={(e) => setPwdOld(e.target.value)}
                  placeholder="请输入当前使用的旧密码"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">新密码（至少6位）</p>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="请输入新密码，至少6位"
                  maxLength={32}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">确认新密码</p>
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  placeholder="请再次输入新密码"
                  maxLength={32}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowPasswordModal(false); resetPasswordForm(); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPwd}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {changingPwd ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    提交中
                  </>
                ) : (
                  '确认修改'
                )}
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400 text-center">若忘记旧密码无法填写，请联系管理员在后台重置密码</p>
          </div>
        </div>
      )}

      {/* 悬浮固定保存栏：编辑态常驻底部（APP 内位于 dock 上方），无需往上拉即可保存 */}
      {editing && (
        <div
          className="fixed left-0 right-0 z-40 px-4"
          style={{ bottom: isH5 ? 'calc(env(safe-area-inset-bottom) + 16px)' : 'calc(env(safe-area-inset-bottom) + 78px)' }}
        >
          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={() => setEditing(false)}
              disabled={loading}
              className="px-6 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl shadow-lg disabled:opacity-60"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-2xl shadow-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  保存中…
                </>
              ) : (
                <>
                  <Check size={19} />
                  保存资料
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
};

export default memo(ProfilePage);

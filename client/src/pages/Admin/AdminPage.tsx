import { useEffect, useState, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getAdminProducts,
  getAdminMallOrders,
  getAdminUsers,
  getAdminCompanyAudits,
  getAdminConsultOrders,
  getPlatformQrcode,
  updatePlatformQrcode,
  reviewMallPayment,
  shipMallOrder,
  reviewCompanyAudit,
  createAdminProduct,
  updateProfile,
  getCurrentUser,
  confirmConsultPayment,
  reviewConsultWork,
  updateAdminUserPhone,
  adminGetAllChatRooms,
  adminDeleteChatRoom,
  getAdminManagementFees,
  confirmManagementFee,
  getRefundList,
  confirmRefund,
  getNotificationsAll,
  sendNotification,
  getPlatformNotice,
  updatePlatformNotice,
} from '@client/src/api';
import type {
  ProductInfo,
  MallOrderInfo,
  UserInfo,
  ConsultOrderInfo,
  PlatformQrcodeInfo,
} from '@shared/api.interface';
import {
  MALL_ORDER_STATUS_NAMES,
  CONSULT_ORDER_STATUS_NAMES,
  MALL_ORDER_STATUS,
  CONSULT_ORDER_STATUS,
  LEVEL_NAMES,
} from '@shared/api.interface';
import {
  Package,
  ShoppingCart,
  Users,
  FileCheck,
  MessageSquare,
  QrCode,
  Plus,
  ChevronLeft,
  Loader2,
  X,
  MessageCircle,
  Trash2,
  Wallet,
  Bell,
  Smartphone,
  Megaphone,
  Network,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../../utils/errorMessage';
import { Image } from '@client/src/components/ui/image';
import { ProductForm } from '@client/src/components/ProductForm';
import AdminTeamTree from './AdminTeamTree';
import IosDeviceAdmin from './IosDeviceAdmin';
import { playNewTaskSound } from '@client/src/utils/notification-sound';

type TabType = 'products' | 'mall-orders' | 'users' | 'team-tree' | 'company-audits' | 'consult-orders' | 'qrcodes' | 'chat-rooms' | 'management-fees' | 'refunds' | 'notifications' | 'ios-devices';

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [mallOrders, setMallOrders] = useState<MallOrderInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const USER_PAGE_SIZE = 20;
  const [companyAudits, setCompanyAudits] = useState<UserInfo[]>([]);
  const [consultOrders, setConsultOrders] = useState<ConsultOrderInfo[]>([]);
  const [mallQrcode, setMallQrcode] = useState<PlatformQrcodeInfo | null>(null);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [managementFees, setManagementFees] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all');
  const [notifType, setNotifType] = useState<'system' | 'update'>('update');
  const [notifUserId, setNotifUserId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifSubmitting, setNotifSubmitting] = useState(false);
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeSaving, setNoticeSaving] = useState(false);
  // 通知编辑态：编辑期间禁止定时刷新/服务器内容覆盖，避免正在编辑的内容丢失
  const noticeEditingRef = useRef(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductInfo | null>(null);

  // 发货页面模式相关状态
  const [shippingOrder, setShippingOrder] = useState<MallOrderInfo | null>(null);
  const [shippingCompany, setShippingCompany] = useState('');
  const [shippingNo, setShippingNo] = useState('');
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

  // 修改用户手机号相关状态
  const [editingPhoneUser, setEditingPhoneUser] = useState<UserInfo | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // 查看用户资料状态
  const [viewingUser, setViewingUser] = useState<UserInfo | null>(null);

  // 删除用户相关状态
  const [deletingUser, setDeletingUser] = useState<UserInfo | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // 记录上一次待审核订单数量，用于新订单提示音
  const prevPendingReviewCountRef = useRef<number>(0);
  const prevPendingConsultCountRef = useRef<number>(0);

  const LOGISTICS_COMPANIES = [
    '顺丰速运',
    '中通快递',
    '圆通速递',
    '韵达快递',
    '申通快递',
    '京东物流',
    '邮政EMS',
    '极兔速递',
    '德邦快递',
    '无需物流',
  ];

  useEffect(() => {
    loadTabData(activeTab);
    if (activeTab === 'chat-rooms') {
      getPlatformNotice()
        .then((d: any) => { if (!noticeEditingRef.current) setNoticeContent(d?.content || ''); })
        .catch(() => {});
    }
    // 每30秒自动刷新当前tab数据（审核后台实时更新）
    // 编辑商品时暂停自动刷新，避免表单内容丢失
    const interval = setInterval(() => {
      if (!showProductForm && !noticeEditingRef.current) {
        loadTabData(activeTab);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, showProductForm]);

  async function loadTabData(tab: TabType) {
    setLoading(true);
    try {
      switch (tab) {
        case 'products': {
          const data = await getAdminProducts({ page: 1, pageSize: 20 });
          setProducts(data.items || []);
          break;
        }
        case 'mall-orders': {
          const data = await getAdminMallOrders({ page: 1, pageSize: 20 });
          const orders = data.items || [];
          setMallOrders(orders);
          // 检测新的待审核订单
          const pendingCount = orders.filter(o => o.status === MALL_ORDER_STATUS.PENDING_REVIEW).length;
          if (prevPendingReviewCountRef.current > 0 && pendingCount > prevPendingReviewCountRef.current) {
            playNewTaskSound();
            toast.info('有新的商城订单待审核！');
          }
          prevPendingReviewCountRef.current = pendingCount;
          break;
        }
        case 'users': {
          const data = await getAdminUsers({ page: userPage, pageSize: USER_PAGE_SIZE });
          setUsers(data.items || []);
          setUserTotal(data.total || 0);
          break;
        }
        case 'company-audits': {
          const data = await getAdminCompanyAudits({ page: 1, pageSize: 20 });
          setCompanyAudits(data.items || []);
          break;
        }
        case 'consult-orders': {
          const data = await getAdminConsultOrders({ page: 1, pageSize: 20 });
          const orders = data.items || [];
          setConsultOrders(orders);
          // 检测新的待审核咨询订单
          const pendingCount = orders.filter(o => o.status === CONSULT_ORDER_STATUS.PENDING_CONFIRM).length;
          if (prevPendingConsultCountRef.current > 0 && pendingCount > prevPendingConsultCountRef.current) {
            playNewTaskSound();
            toast.info('有新的咨询订单待审核！');
          }
          prevPendingConsultCountRef.current = pendingCount;
          break;
        }
        case 'qrcodes': {
          try {
            const data = await getPlatformQrcode('mall_platform');
            setMallQrcode(data);
          } catch (e) {
            logger.error('获取收款码失败', e);
          }
          // 加载管理员咨询师收款码
          try {
            const userData = await getCurrentUser();
            setAdminWechatQrcode(userData.wechatQrcodeUrl || '');
            setAdminAlipayQrcode(userData.alipayQrcodeUrl || '');
          } catch (e) {
            logger.error('获取管理员收款码失败', e);
          }
          break;
        }
        case 'chat-rooms': {
          const data = await adminGetAllChatRooms();
          setChatRooms(data.items || []);
          break;
        }
        case 'management-fees': {
          const data = await getAdminManagementFees({ page: 1, pageSize: 50 });
          setManagementFees(data.items || []);
          break;
        }
        case 'refunds': {
          const data = await getRefundList();
          setRefunds(Array.isArray(data) ? data : []);
          break;
        }
        case 'notifications': {
          const data = await getNotificationsAll();
          setSentNotifications(Array.isArray(data.notifications) ? data.notifications : []);
          break;
        }
      }
    } catch (error) {
      logger.error(`加载${tab}失败`, error);
    } finally {
      setLoading(false);
    }
  }

  const fillUpdateTemplate = () => {
    setNotifType('update');
    setNotifTitle('AI快卖 版本更新提醒');
    setNotifBody('系统已升级到最新版本，请点击本通知一键更新，体验更稳定的卖货与赚钱功能；如未自动弹出，请重新打开APP。');
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    if (notifTarget === 'user' && !notifUserId.trim()) {
      toast.error('请填写指定用户ID');
      return;
    }
    setNotifSubmitting(true);
    try {
      await sendNotification({
        target: notifTarget,
        userId: notifTarget === 'user' ? notifUserId.trim() : undefined,
        title: notifTitle.trim(),
        body: notifBody.trim(),
        type: notifType,
      });
      toast.success('通知已发送');
      setNotifTitle('');
      setNotifBody('');
      setNotifUserId('');
      const data = await getNotificationsAll();
      setSentNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      logger.error('发送通知失败', error);
      toast.error(getErrorMessage(error, '发送通知'));
    } finally {
      setNotifSubmitting(false);
    }
  };

  const handleSaveNotice = async () => {
    setNoticeSaving(true);
    try {
      await updatePlatformNotice(noticeContent);
      noticeEditingRef.current = false;
      toast.success('平台通知已保存');
    } catch (error) {
      toast.error(getErrorMessage(error, '保存平台通知'));
    } finally {
      setNoticeSaving(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: typeof Package }[] = [
    { key: 'products', label: '商品管理', icon: Package },
    { key: 'mall-orders', label: '商城订单', icon: ShoppingCart },
    { key: 'users', label: '用户管理', icon: Users },
    { key: 'team-tree', label: '全用户关系树', icon: Network },
    { key: 'company-audits', label: '公司审核', icon: FileCheck },
    { key: 'consult-orders', label: '咨询订单', icon: MessageSquare },
    { key: 'qrcodes', label: '收款码管理', icon: QrCode },
    { key: 'chat-rooms', label: '聊天室管理', icon: MessageCircle },
    { key: 'management-fees', label: '推广费审核', icon: Wallet },
    { key: 'refunds', label: '返还打款', icon: Wallet },
    { key: 'notifications', label: '通知推送', icon: Bell },
    { key: 'ios-devices', label: '苹果设备', icon: Smartphone },
  ];

  async function handleReviewPayment(orderId: string, passed: boolean) {
    try {
      await reviewMallPayment(orderId, passed);
      loadTabData('mall-orders');
    } catch (error) {
      logger.error('审核失败', error);
      toast.error(getErrorMessage(error, '审核付款'));
    }
  }

  function handleShip(order: MallOrderInfo) {
    setShippingOrder(order);
    setShippingCompany('');
    setShippingNo('');
  }

  async function handleConfirmShip() {
    if (!shippingOrder) return;
    if (!shippingCompany) {
      toast('请选择物流公司');
      return;
    }
    if (shippingCompany !== '无需物流' && !shippingNo.trim()) {
      toast('请输入物流单号');
      return;
    }
    try {
      setShippingSubmitting(true);
      await shipMallOrder(shippingOrder.id, {
        logisticsCompany: shippingCompany,
        logisticsNo: shippingCompany === '无需物流' ? '' : shippingNo.trim(),
      });
      toast('发货成功');
      setShippingOrder(null);
      loadTabData('mall-orders');
    } catch (error) {
      logger.error('发货失败', error);
      toast.error(getErrorMessage(error, '发货'));
    } finally {
      setShippingSubmitting(false);
    }
  }

  function handleCancelShip() {
    setShippingOrder(null);
    setShippingCompany('');
    setShippingNo('');
  }

  async function handleReviewCompany(userId: string, passed: boolean) {
    const remark = passed ? '' : prompt('请输入拒绝原因') || '';
    if (!passed && !remark) return;
    try {
      await reviewCompanyAudit(userId, passed, remark);
      loadTabData('company-audits');
    } catch (error) {
      logger.error('审核失败', error);
      toast.error(getErrorMessage(error, '审核公司资质'));
    }
  }

  async function handleConfirmConsultPayment(orderId: string) {
    try {
      await confirmConsultPayment(orderId);
      toast('确认收款成功');
      loadTabData('consult-orders');
    } catch (error) {
      logger.error('确认收款失败', error);
      toast.error(getErrorMessage(error, '确认收款'));
    }
  }

  async function handleReviewConsultWork(orderId: string, passed: boolean) {
    const remark = passed ? '' : prompt('请输入驳回原因') || '';
    if (!passed && !remark) return;
    try {
      await reviewConsultWork(orderId, passed, remark);
      toast(passed ? '作业审核通过' : '作业已驳回');
      loadTabData('consult-orders');
    } catch (error) {
      logger.error('审核作业失败', error);
      toast.error(getErrorMessage(error, '审核作业'));
    }
  }

  // 打开修改手机号对话框
  function handleOpenPhoneEdit(user: UserInfo) {
    setEditingPhoneUser(user);
    setNewPhone(user.phone || '');
    setPhoneError('');
  }

  // 提交修改手机号
  async function handleSubmitPhone() {
    if (!editingPhoneUser) return;
    if (!/^1\d{10}$/.test(newPhone)) {
      setPhoneError('请输入正确的11位手机号');
      return;
    }
    setPhoneSubmitting(true);
    setPhoneError('');
    try {
      await updateAdminUserPhone(editingPhoneUser.id, newPhone);
      toast('手机号修改成功');
      setEditingPhoneUser(null);
      loadTabData('users');
    } catch (error: any) {
      setPhoneError(getErrorMessage(error, '修改手机号'));
      logger.error('修改手机号失败', error);
    } finally {
      setPhoneSubmitting(false);
    }
  }

  // 重置用户密码（用户忘记密码、无短信验证码时的兜底方案）
  const loadUserPage = async (page: number) => {
    try {
      const data = await getAdminUsers({ page, pageSize: USER_PAGE_SIZE });
      setUsers(data.items || []);
      setUserTotal(data.total || 0);
      setUserPage(page);
    } catch (err) {
      toast(getErrorMessage(err, '加载用户'));
    }
  };

  async function handleResetPassword(user: UserInfo) {
    const newPassword = window.prompt(
      `将为「${user.nickname}（${user.phone}）」重置密码。\n请输入新密码（至少6位）：`,
      '123456',
    );
    if (newPassword === null) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('新密码长度至少6位');
      return;
    }
    try {
      const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');
      await axiosForBackend.post(`/api/admin/users/${user.id}/reset-password`, { newPassword });
      toast.success('密码已重置为：' + newPassword);
    } catch (e: any) {
      toast.error(getErrorMessage(e, '重置密码'));
    }
  }

  // 删除用户
  async function handleDeleteUser() {
    if (!deletingUser) return;
    if (!adminPassword) {
      toast.error('请输入管理员密码');
      return;
    }
    setDeleteSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kuaimai_token')}`,
        },
        body: JSON.stringify({ keepPhones: ['13800000000'], deleteUserIds: [deletingUser.id], adminPassword }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || '删除失败');
      }
      toast('用户删除成功');
      setDeletingUser(null);
      setAdminPassword('');
      loadTabData('users');
    } catch (error: any) {
      toast.error(getErrorMessage(error, '删除用户'));
      logger.error('删除用户失败', error);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleAddProduct() {
    setEditingProduct(null);
    setShowProductForm(true);
  }

  function handleEditProduct(product: ProductInfo) {
    setEditingProduct(product);
    setShowProductForm(true);
  }

  function handleProductSuccess() {
    setShowProductForm(false);
    setEditingProduct(null);
    loadTabData('products');
  }

  async function handleDeleteProduct(product: ProductInfo) {
    if (!window.confirm(`确定删除商品「${product.name}」吗？删除后不可恢复。`)) return;
    try {
      const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');
      await axiosForBackend.delete(`/api/admin/products/${product.id}`);
      toast.success('商品已删除');
      loadTabData('products');
    } catch (e: any) {
      toast.error(getErrorMessage(e, '删除商品'));
    }
  }

  const qrcodeFileRef = useRef<HTMLInputElement>(null);
  const [qrcodeUploading, setQrcodeUploading] = useState(false);
  const [qrcodeUploadTarget, setQrcodeUploadTarget] = useState<{ type: string; field: string } | null>(null);
  const [adminWechatQrcode, setAdminWechatQrcode] = useState<string>('');
  const [adminAlipayQrcode, setAdminAlipayQrcode] = useState<string>('');

  async function handleUpdateQrcode(type: string, field: string) {
    setQrcodeUploadTarget({ type, field });
    qrcodeFileRef.current?.click();
  }

  async function handleUpdateAdminQrcode(field: string) {
    setQrcodeUploadTarget({ type: 'admin_consultant', field });
    qrcodeFileRef.current?.click();
  }

  async function handleQrcodeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !qrcodeUploadTarget) return;

    const { type, field } = qrcodeUploadTarget;
    setQrcodeUploading(true);
    try {
      // 读取文件为 base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      // 上传到服务器
      const { axiosForBackend } = await import('@lark-apaas/client-toolkit/utils/getAxiosForBackend');
      const response = await axiosForBackend.post('/api/upload/image', { base64 });
      if (!response.data.success) {
        throw new Error(response.data.message || '上传失败');
      }

      // 更新收款码
      if (type === 'admin_consultant') {
        // 更新管理员咨询师收款码
        await updateProfile({ [field]: response.data.url });
        toast('管理员收款码更新成功');
        if (field === 'wechatQrcodeUrl') {
          setAdminWechatQrcode(response.data.url);
        } else if (field === 'alipayQrcodeUrl') {
          setAdminAlipayQrcode(response.data.url);
        }
      } else {
        // 更新平台收款码
        await updatePlatformQrcode(type, { [field]: response.data.url });
        toast('收款码更新成功');
        // 立即更新本地状态，不需要等待重新加载
        setMallQrcode((prev) => {
          if (!prev) return { id: '', type, [field]: response.data.url } as PlatformQrcodeInfo;
          return { ...prev, [field]: response.data.url };
        });
        await loadTabData('qrcodes');
      }
    } catch (error) {
      logger.error('更新收款码失败', error);
      toast.error(getErrorMessage(error, '更新收款码'));
    } finally {
      setQrcodeUploading(false);
      setQrcodeUploadTarget(null);
      if (qrcodeFileRef.current) {
        qrcodeFileRef.current.value = '';
      }
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="md:w-56 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">平台后台</h2>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 bg-white rounded-xl shadow-sm p-6 min-h-96">
        {loading ? (
          <div className="text-center text-gray-500 py-12">加载中...</div>
        ) : (
          <>
            {activeTab === 'products' && (
              <div>
                {showProductForm ? (
                  <ProductForm
                    product={editingProduct}
                    onSuccess={handleProductSuccess}
                    onCancel={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">商品管理</h3>
                      <button
                        onClick={handleAddProduct}
                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
                      >
                        <Plus size={16} />
                        添加商品
                      </button>
                    </div>
                    <div className="space-y-3">
                      {products.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">暂无商品</div>
                      ) : (
                        products.map((p: ProductInfo) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg"
                          >
                            <Image
                              src={p.mainImages?.[0]?.url}
                              alt={p.name}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{p.name}</div>
                              <div className="text-sm text-gray-500">
                                ¥{p.price} · {p.status === 'on_sale' ? '在售' : '下架'}
                              </div>
                            </div>
                            <button
                              onClick={() => handleEditProduct(p)}
                              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition inline-flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'mall-orders' && (
              <div>
                <h3 className="text-lg font-bold mb-4">商城订单</h3>
                <div className="space-y-3">
                  {mallOrders.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">暂无订单</div>
                  ) : (
                    mallOrders.map((o: MallOrderInfo) => (
                      <div
                        key={o.id}
                        className="p-4 border border-gray-100 rounded-lg shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700">订单号：{o.orderNo}</span>
                            <div className="text-xs text-gray-400 mt-1">
                              下单时间：{new Date(o.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-orange-600">
                            {MALL_ORDER_STATUS_NAMES?.[o.status] || o.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <Image
                            src={o.productImage}
                            alt={o.productName}
                            className="w-14 h-14 object-cover rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{o.productName}</div>
                            <div className="text-sm text-gray-500">
                              ¥{o.totalAmount} · {o.quantity}件
                            </div>
                          </div>
                        </div>
                        {/* 收货信息 */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                          <div className="font-medium text-gray-700 mb-1">收货信息</div>
                          <div className="text-gray-600">收货人：{o.receiveName || '-'}</div>
                          <div className="text-gray-600">电话：{o.receivePhone || '-'}</div>
                          <div className="text-gray-600">地址：{o.receiveAddress || '-'}</div>
                        </div>
                        {/* 付款截图 */}
                        {o.paymentScreenshotUrl && !o.paymentScreenshotUrl.startsWith('blob:') && !o.paymentScreenshotUrl.startsWith('data:') && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-gray-700 mb-2">付款截图</div>
                            <div className="border border-gray-200 rounded-lg p-2 inline-block">
                              <Image
                                src={o.paymentScreenshotUrl}
                                alt="付款截图"
                                className="max-w-[200px] max-h-[200px] object-contain rounded"
                              />
                            </div>
                          </div>
                        )}
                        {(o.paymentScreenshotUrl?.startsWith('blob:') || o.paymentScreenshotUrl?.startsWith('data:')) && (
                          <div className="mb-3 text-xs text-orange-500 bg-orange-50 p-2 rounded">付款截图已失效（旧版本数据），请让用户重新上传</div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {o.status === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleReviewPayment(o.id, true)}
                                className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                              >
                                通过收款
                              </button>
                              <button
                                onClick={() => handleReviewPayment(o.id, false)}
                                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                              >
                                拒绝
                              </button>
                            </>
                          )}
                          {o.status === 'pending_shipment' && (
                            <button
                              onClick={() => handleShip(o)}
                              className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 font-medium"
                            >
                              发货
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'team-tree' && <AdminTeamTree />}
            {activeTab === 'ios-devices' && <IosDeviceAdmin />}

            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-bold mb-4">用户管理</h3>
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">暂无用户</div>
                  ) : (
                    users.map((u: UserInfo) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg"
                      >
                        <Image
                          src={u.avatarUrl || 'https://picsum.photos/seed/user/40/40'}
                          alt={u.nickname}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{u.nickname}</div>
                          <div className="text-xs text-gray-500">
                            {u.phone} · {LEVEL_NAMES?.[u.level] || u.level}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewingUser(u)}
                            className="text-xs text-orange-600 hover:text-orange-700 px-2 py-1 border border-orange-200 rounded hover:bg-orange-50"
                          >
                            查看资料
                          </button>
                          <button
                            onClick={() => handleOpenPhoneEdit(u)}
                            className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
                          >
                            修改手机号
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="text-xs text-amber-600 hover:text-amber-700 px-2 py-1 border border-amber-200 rounded hover:bg-amber-50"
                          >
                            重置密码
                          </button>
                          {u.phone !== '13800000000' && (
                            <button
                              onClick={() => {
                                if ((u.directInviteCount || 0) > 0) {
                                  toast('该用户已有下线，无法删除');
                                  return;
                                }
                                setDeletingUser(u);
                              }}
                              className={`text-xs px-2 py-1 border rounded ${
                                (u.directInviteCount || 0) > 0
                                  ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50'
                              }`}
                              title={(u.directInviteCount || 0) > 0 ? '已有下线，无法删除' : '删除用户'}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {userTotal > USER_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      共 {userTotal} 人，第 {userPage} / {Math.ceil(userTotal / USER_PAGE_SIZE)} 页
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadUserPage(userPage - 1)}
                        disabled={userPage <= 1}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => loadUserPage(userPage + 1)}
                        disabled={userPage >= Math.ceil(userTotal / USER_PAGE_SIZE)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'company-audits' && (
              <div>
                <h3 className="text-lg font-bold mb-4">公司资质审核</h3>
                <div className="space-y-3">
                  {companyAudits.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">暂无待审核</div>
                  ) : (
                    companyAudits.map((u: UserInfo) => (
                      <div
                        key={u.id}
                        className="p-3 border border-gray-100 rounded-lg"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Image
                            src={u.avatarUrl || 'https://picsum.photos/seed/user/40/40'}
                            alt={u.nickname}
                            className="w-10 h-10 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{u.nickname}</div>
                            <div className="text-xs text-gray-500">手机号：{u.phone}</div>
                            {u.realName && <div className="text-xs text-gray-500">真实姓名：{u.realName}</div>}
                            {u.wechatId && <div className="text-xs text-gray-500">微信号：{u.wechatId}</div>}
                          </div>
                        </div>
                        {/* 身份证信息 */}
                        <div className="bg-gray-50 rounded-lg p-2 mb-2">
                          <p className="text-xs font-medium text-gray-600 mb-1">实名认证信息</p>
                          <div className="flex gap-2 flex-wrap">
                            {u.idCardFrontUrl ? (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">身份证正面</p>
                                <Image
                                  src={u.idCardFrontUrl}
                                  alt="身份证正面"
                                  className="w-32 h-20 object-cover rounded"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-red-500">未上传身份证正面</p>
                            )}
                            {u.idCardBackUrl ? (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">身份证反面</p>
                                <Image
                                  src={u.idCardBackUrl}
                                  alt="身份证反面"
                                  className="w-32 h-20 object-cover rounded"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-red-500">未上传身份证反面</p>
                            )}
                          </div>
                        </div>
                        {u.businessLicenseUrl && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">营业执照</p>
                            <Image
                              src={u.businessLicenseUrl}
                              alt="营业执照"
                              className="w-32 h-32 object-cover rounded"
                            />
                          </div>
                        )}
                        {u.companyQrcodeUrl && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">公司收款码</p>
                            <Image
                              src={u.companyQrcodeUrl}
                              alt="公司收款码"
                              className="w-32 h-32 object-cover rounded"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReviewCompany(u.id, true)}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleReviewCompany(u.id, false)}
                            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'consult-orders' && (
              <div>
                <h3 className="text-lg font-bold mb-4">咨询订单</h3>
                <div className="space-y-2">
                  {consultOrders.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">暂无咨询订单</div>
                  ) : (
                    consultOrders.map((o: ConsultOrderInfo) => (
                      <div
                        key={o.id}
                        className="p-3 border border-gray-100 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-500">订单号：{o.orderNo}</span>
                          <span className="text-sm font-medium text-blue-600">
                            {CONSULT_ORDER_STATUS_NAMES?.[o.status] || o.status}
                          </span>
                        </div>
                        <div className="text-sm mb-2">
                          服务类型：{o.serviceType} · 金额：¥{o.amount}
                        </div>
                        {/* 付款截图 */}
                        {o.paymentScreenshotUrl && !o.paymentScreenshotUrl.startsWith('blob:') && (
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 mb-1">付款截图</div>
                            <img
                              src={o.paymentScreenshotUrl}
                              alt="付款截图"
                              className="max-w-[150px] max-h-[150px] object-contain rounded border"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}
                        {o.paymentScreenshotUrl?.startsWith('blob:') && (
                          <div className="mb-2 text-xs text-orange-500 bg-orange-50 p-2 rounded">付款截图已失效（旧版本数据），请让用户重新上传</div>
                        )}
                        {/* 作业截图 */}
                        {o.workScreenshotUrl && !o.workScreenshotUrl.startsWith('blob:') && (
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 mb-1">作业截图</div>
                            <img
                              src={o.workScreenshotUrl}
                              alt="作业截图"
                              className="max-w-[150px] max-h-[150px] object-contain rounded border"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}
                        {o.workScreenshotUrl?.startsWith('blob:') && (
                          <div className="mb-2 text-xs text-orange-500 bg-orange-50 p-2 rounded">作业截图已失效（旧版本数据），请让用户重新上传</div>
                        )}
                        {/* 审核按钮 */}
                        <div className="flex gap-2 mt-2">
                          {o.status === 'pending_confirm' && (
                            <button
                              onClick={() => handleConfirmConsultPayment(o.id)}
                              className="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                            >
                              确认收款
                            </button>
                          )}
                          {o.status === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleReviewConsultWork(o.id, true)}
                                className="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                              >
                                作业通过
                              </button>
                              <button
                                onClick={() => handleReviewConsultWork(o.id, false)}
                                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                              >
                                作业驳回
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'qrcodes' && (
              <div>
                <h3 className="text-lg font-bold mb-4">平台收款码管理</h3>
                <input
                  ref={qrcodeFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQrcodeFileChange}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border border-gray-100 rounded-lg">
                    <div className="font-medium mb-3">商城平台收款码</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">微信收款码</div>
                        {mallQrcode?.wechatQrcodeUrl ? (
                          <img
                            src={mallQrcode.wechatQrcodeUrl}
                            alt="微信"
                            className="w-full aspect-square object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                            未设置
                          </div>
                        )}
                        <button
                          onClick={() => handleUpdateQrcode('mall_platform', 'wechatQrcodeUrl')}
                          disabled={qrcodeUploading}
                          className="mt-2 w-full py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {qrcodeUploading && qrcodeUploadTarget?.field === 'wechatQrcodeUrl' ? '上传中...' : '修改'}
                        </button>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">支付宝收款码</div>
                        {mallQrcode?.alipayQrcodeUrl ? (
                          <img
                            src={mallQrcode.alipayQrcodeUrl}
                            alt="支付宝"
                            className="w-full aspect-square object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                            未设置
                          </div>
                        )}
                        <button
                          onClick={() => handleUpdateQrcode('mall_platform', 'alipayQrcodeUrl')}
                          disabled={qrcodeUploading}
                          className="mt-2 w-full py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {qrcodeUploading && qrcodeUploadTarget?.field === 'alipayQrcodeUrl' ? '上传中...' : '修改'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 管理员咨询师收款码（零号线） */}
                  <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                    <div className="font-medium mb-1 text-orange-700">管理员咨询师收款码（零号线）</div>
                    <div className="text-xs text-orange-500 mb-3">没有上级推荐人时，学员咨询服务费将付给此收款码</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">微信收款码</div>
                        {adminWechatQrcode ? (
                          <img
                            src={adminWechatQrcode}
                            alt="微信"
                            className="w-full aspect-square object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                            未设置
                          </div>
                        )}
                        <button
                          onClick={() => handleUpdateAdminQrcode('wechatQrcodeUrl')}
                          disabled={qrcodeUploading}
                          className="mt-2 w-full py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {qrcodeUploading && qrcodeUploadTarget?.field === 'wechatQrcodeUrl' && qrcodeUploadTarget?.type === 'admin_consultant' ? '上传中...' : '上传'}
                        </button>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">支付宝收款码</div>
                        {adminAlipayQrcode ? (
                          <img
                            src={adminAlipayQrcode}
                            alt="支付宝"
                            className="w-full aspect-square object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                            未设置
                          </div>
                        )}
                        <button
                          onClick={() => handleUpdateAdminQrcode('alipayQrcodeUrl')}
                          disabled={qrcodeUploading}
                          className="mt-2 w-full py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {qrcodeUploading && qrcodeUploadTarget?.field === 'alipayQrcodeUrl' && qrcodeUploadTarget?.type === 'admin_consultant' ? '上传中...' : '上传'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 推广费审核 */}
            {activeTab === 'management-fees' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">推广费审核</h3>
                  <span className="text-xs text-gray-500">卖家每日12点前上交昨日成交额8%</span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  </div>
                ) : managementFees.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    暂无推广费记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {managementFees.map((fee: any) => (
                      <div key={fee.id} className="p-4 rounded-lg border bg-white border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">{fee.sellerName || fee.sellerId?.slice(0,8)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                fee.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                fee.status === 'pending_review' ? 'bg-blue-100 text-blue-700' :
                                fee.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {fee.status === 'pending' ? '待支付' :
                                 fee.status === 'pending_review' ? '待审核' :
                                 fee.status === 'confirmed' ? '已确认' : '已逾期'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                              <span>费期：{fee.feeDate?.slice(0,10)}</span>
                              <span>成交额：¥{Number(fee.totalSales).toFixed(2)}</span>
                              <span className="text-orange-600 font-medium">推广费：¥{Number(fee.feeAmount).toFixed(2)}</span>
                              {fee.deadline && <span>截止：{new Date(fee.deadline).toLocaleString('zh-CN')}</span>}
                            </div>
                            {fee.paymentScreenshotUrl && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 mb-1">支付凭证：</p>
                                <img src={fee.paymentScreenshotUrl} alt="支付凭证" className="w-32 h-32 object-cover rounded-lg border" />
                              </div>
                            )}
                          </div>
                          {fee.status === 'pending_review' && (
                            <button
                              onClick={() => {
                                if (window.confirm('确认该推广费已到账？')) {
                                  confirmManagementFee(fee.id)
                                    .then(() => { toast.success('已确认到账'); loadTabData('management-fees'); })
                                    .catch((err) => toast.error(getErrorMessage(err, '确认推广费')));
                                }
                              }}
                              className="ml-3 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex-shrink-0"
                            >
                              确认到账
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 四星考核返还打款 */}
            {activeTab === 'refunds' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">四星考核返还打款</h3>
                  <span className="text-xs text-gray-500">达标自动生成申请，平台扫码付给用户</span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  </div>
                ) : refunds.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    暂无返还打款申请
                  </div>
                ) : (
                  <div className="space-y-3">
                    {refunds.map((r: any) => (
                      <div key={r.id} className="p-4 rounded-lg border bg-white border-gray-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{r.realName || r.nickname}</span>
                          <span className="text-xs text-gray-500">{r.phone}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.refundStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {r.refundStatus === 'pending' ? '待打款' : '已打款'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                          <span>平台代收：¥{Number(r.platformCollectedAmount).toFixed(2)}</span>
                          <span>返还比例：{r.refundRate}%</span>
                          <span className="text-orange-600 font-medium">应返还：¥{Number(r.refundedAmount).toFixed(2)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {r.wechatQrcodeUrl && (
                            <div className="text-center">
                              <img src={r.wechatQrcodeUrl} alt="微信收款码" className="w-36 h-36 object-cover rounded-lg border" />
                              <p className="text-xs text-gray-500 mt-1">微信收款码</p>
                            </div>
                          )}
                          {r.alipayQrcodeUrl && (
                            <div className="text-center">
                              <img src={r.alipayQrcodeUrl} alt="支付宝收款码" className="w-36 h-36 object-cover rounded-lg border" />
                              <p className="text-xs text-gray-500 mt-1">支付宝收款码</p>
                            </div>
                          )}
                          {r.companyQrcodeUrl && (
                            <div className="text-center">
                              <img src={r.companyQrcodeUrl} alt="企业收款码" className="w-36 h-36 object-cover rounded-lg border" />
                              <p className="text-xs text-gray-500 mt-1">企业收款码</p>
                            </div>
                          )}
                          {!r.wechatQrcodeUrl && !r.alipayQrcodeUrl && !r.companyQrcodeUrl && (
                            <p className="text-xs text-red-500">该用户未上传收款码，请联系用户补充</p>
                          )}
                        </div>
                        {r.refundStatus === 'pending' && (
                          <button
                            onClick={() => {
                              if (window.confirm('确认已按用户收款码完成返还打款？')) {
                                confirmRefund(r.id)
                                  .then(() => { toast.success('已确认打款'); loadTabData('refunds'); })
                                  .catch((err) => toast.error(getErrorMessage(err, '确认打款')));
                              }
                            }}
                            className="mt-3 px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                          >
                            我已扫码支付，确认打款
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 通知推送 */}
            {activeTab === 'notifications' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">通知推送</h3>
                  <span className="text-xs text-gray-500">在线用户约40秒内收到，可用于提醒更新</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <label className="text-sm text-gray-600">接收对象</label>
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      value={notifTarget}
                      onChange={(e) => setNotifTarget(e.target.value as 'all' | 'user')}
                    >
                      <option value="all">全员广播</option>
                      <option value="user">指定用户</option>
                    </select>
                    <label className="text-sm text-gray-600 ml-2">类型</label>
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      value={notifType}
                      onChange={(e) => setNotifType(e.target.value as 'system' | 'update')}
                    >
                      <option value="system">普通通知</option>
                      <option value="update">版本更新</option>
                    </select>
                  </div>
                  {notifTarget === 'user' && (
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
                      placeholder="指定用户ID"
                      value={notifUserId}
                      onChange={(e) => setNotifUserId(e.target.value)}
                    />
                  )}
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
                    placeholder="通知标题"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                  />
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
                    rows={3}
                    placeholder="通知内容"
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      disabled={notifSubmitting || !notifTitle || !notifBody}
                      className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      onClick={handleSendNotification}
                    >
                      {notifSubmitting ? '发送中...' : '立即发送'}
                    </button>
                    <button
                      className="px-3 py-2 border border-gray-300 text-sm rounded-lg text-gray-600"
                      onClick={fillUpdateTemplate}
                    >
                      填入版本更新模板
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">已发通知</h4>
                <div className="space-y-2">
                  {sentNotifications.length === 0 && (
                    <p className="text-sm text-gray-400 py-4 text-center">暂无发送记录</p>
                  )}
                  {sentNotifications.map((n) => (
                    <div key={n.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-xs text-gray-400">
                          {n.userId ? '指定用户' : '全员'} · {n.type === 'update' ? '版本更新' : '普通'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 聊天室管理 */}
            {activeTab === 'chat-rooms' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">聊天室管理</h3>
                  <span className="text-xs text-gray-500">已结束超过24小时的聊天室将自动删除</span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  </div>
                ) : chatRooms.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    暂无聊天室
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatRooms.map((room: any) => (
                      <div
                        key={room.id}
                        className={`p-4 rounded-lg border ${
                          room.isActive && !room.isExpired
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{room.name}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  room.isActive && !room.isExpired
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {room.isActive && !room.isExpired ? '运行中' : '已结束'}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                {room.type === 'public' ? '公开' : '个人'}
                              </span>
                            </div>
                            {room.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{room.description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                              <span>创建者：{room.creatorNickname}（{room.creatorPhone}）</span>
                              {room.scheduledStartTime && (
                                <span>开始：{new Date(room.scheduledStartTime).toLocaleString('zh-CN')}</span>
                              )}
                              {room.scheduledEndTime && (
                                <span>结束：{new Date(room.scheduledEndTime).toLocaleString('zh-CN')}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`确定删除聊天室「${room.name}」吗？此操作不可恢复。`)) {
                                adminDeleteChatRoom(room.id)
                                  .then(() => {
                                    toast.success('聊天室已删除');
                                    loadTabData('chat-rooms');
                                  })
                                  .catch((err) => toast.error(getErrorMessage(err, '删除聊天室')));
                              }
                            }}
                            className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                            title="删除聊天室"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 平台通知栏（互动中心底部展示）编辑 */}
                <div className="mt-6 bg-white rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Megaphone className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-bold text-gray-800">平台通知栏</h4>
                    <span className="text-xs text-gray-400">（展示在互动中心页面底部，固定高度只显示一部分、可滑动查看全部）</span>
                  </div>
                  <textarea
                    value={noticeContent}
                    onFocus={() => { noticeEditingRef.current = true; }}
                    onChange={(e) => {
                      noticeEditingRef.current = true;
                      setNoticeContent(e.target.value);
                      // 自动增高：随内容撑开，用页面整体滚动来编辑，不在小框内下拉
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = 'auto';
                      el.style.height = Math.max(el.scrollHeight, 200) + 'px';
                    }}
                    placeholder="输入平台通知内容，支持换行。编辑期间页面不会自动刷新打断。"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y overflow-hidden"
                    rows={10}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{noticeContent.length} 字</span>
                    <button
                      onClick={handleSaveNotice}
                      disabled={noticeSaving}
                      className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {noticeSaving ? '保存中...' : '保存通知'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 发货页面模式 */}
      {shippingOrder && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
          {/* 顶部导航栏 */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <button
                onClick={handleCancelShip}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h1 className="text-base font-semibold text-gray-900">订单发货</h1>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
            {/* 订单信息 */}
            <div className="bg-white rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">订单信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">订单号</span>
                  <span className="text-gray-900 font-medium">{shippingOrder.orderNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">商品</span>
                  <span className="text-gray-900">{shippingOrder.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">数量</span>
                  <span className="text-gray-900">{shippingOrder.quantity}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">实付金额</span>
                  <span className="text-orange-500 font-bold">¥{shippingOrder.totalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">收货人</span>
                  <span className="text-gray-900">{shippingOrder.receiveName} {shippingOrder.receivePhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">收货地址</span>
                  <span className="text-gray-900 text-right max-w-[60%]">{shippingOrder.receiveAddress}</span>
                </div>
              </div>
            </div>

            {/* 物流信息 */}
            <div className="bg-white rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">物流信息</h3>

              {/* 物流公司选择 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">物流公司</label>
                <select
                  value={shippingCompany}
                  onChange={(e) => setShippingCompany(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  <option value="">请选择物流公司</option>
                  {LOGISTICS_COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {/* 物流单号输入（选择"无需物流"时隐藏） */}
              {shippingCompany !== '无需物流' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2">物流单号</label>
                  <input
                    type="text"
                    value={shippingNo}
                    onChange={(e) => setShippingNo(e.target.value)}
                    placeholder="请输入物流单号"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* 无需物流提示 */}
              {shippingCompany === '无需物流' && (
                <div className="mt-2 p-3 bg-orange-50 text-orange-600 text-xs rounded-lg">
                  选择"无需物流"后，不需要填写物流单号，订单将直接标记为已发货。
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮 - 在底部导航栏上方显示，避免被遮挡 */}
          <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100">
            <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
              <button
                onClick={handleCancelShip}
                className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-full hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleConfirmShip}
                disabled={shippingSubmitting || !shippingCompany || (shippingCompany !== '无需物流' && !shippingNo.trim())}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {shippingSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    发货中...
                  </>
                ) : (
                  '确认发货'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看用户资料对话框 */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingUser(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">用户详细资料</h3>
              <button onClick={() => setViewingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b">
                <Image src={viewingUser.avatarUrl || 'https://picsum.photos/seed/user/60/60'} alt={viewingUser.nickname} className="w-14 h-14 rounded-full object-cover" />
                <div>
                  <p className="font-bold text-lg">{viewingUser.nickname}</p>
                  <p className="text-sm text-gray-500">{LEVEL_NAMES?.[viewingUser.level] || viewingUser.level}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">手机号：</span>{viewingUser.phone}</div>
                <div><span className="text-gray-500">性别：</span>{viewingUser.gender || '未设置'}</div>
                <div><span className="text-gray-500">年龄：</span>{viewingUser.age || '未设置'}</div>
                <div><span className="text-gray-500">行业：</span>{viewingUser.industry || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">真实姓名：</span>{viewingUser.realName || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">微信号：</span>{viewingUser.wechatId || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">收货地址：</span>{viewingUser.receiveAddress || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">收货电话：</span>{viewingUser.receivePhone || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">资质证明：</span>{viewingUser.qualification || '未设置'}</div>
                <div className="col-span-2"><span className="text-gray-500">服务标准：</span>{viewingUser.serviceStandard || '未设置'}</div>
                <div><span className="text-gray-500">有效直推人数：</span>{viewingUser.directInviteCount || 0}</div>
                <div><span className="text-gray-500">团队人数：</span>{viewingUser.teamTotalCount || 0}</div>
              </div>
              {viewingUser.idCardFrontUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">身份证正面：</p>
                  <Image src={viewingUser.idCardFrontUrl} alt="身份证正面" className="w-full rounded-lg border" />
                </div>
              )}
              {viewingUser.idCardBackUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">身份证反面：</p>
                  <Image src={viewingUser.idCardBackUrl} alt="身份证反面" className="w-full rounded-lg border" />
                </div>
              )}
              {viewingUser.wechatQrcodeUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">微信收款码：</p>
                  <Image src={viewingUser.wechatQrcodeUrl} alt="微信收款码" className="w-40 rounded-lg border" />
                </div>
              )}
              {viewingUser.alipayQrcodeUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">支付宝收款码：</p>
                  <Image src={viewingUser.alipayQrcodeUrl} alt="支付宝收款码" className="w-40 rounded-lg border" />
                </div>
              )}
            </div>
            <button onClick={() => setViewingUser(null)} className="w-full h-11 mt-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 修改用户手机号对话框 */}
      {editingPhoneUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">修改用户手机号</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">用户：{editingPhoneUser.nickname}</p>
              <p className="text-sm text-gray-600">原手机号：{editingPhoneUser.phone}</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                新手机号 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="请输入11位新手机号"
                maxLength={11}
                className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
              {phoneError && (
                <p className="text-xs text-red-500 mt-1">{phoneError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingPhoneUser(null)}
                className="flex-1 h-11 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmitPhone}
                disabled={phoneSubmitting}
                className="flex-1 h-11 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {phoneSubmitting ? '提交中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除用户确认对话框 */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">确认删除用户</h3>
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">确定要删除以下用户吗？</p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{deletingUser.nickname}</p>
                <p className="text-xs text-gray-500">{deletingUser.phone}</p>
              </div>
              <p className="text-xs text-red-500 mt-3">删除后该用户的所有订单、任务、团队关系将被清除，此操作不可恢复。</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-1 block">管理员密码</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="请输入当前管理员登录密码"
                autoComplete="off"
                className="w-full h-11 border border-gray-300 rounded-lg px-3 text-sm focus:border-orange-400 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">为防止误删，需再次验证管理员密码。</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingUser(null); setAdminPassword(''); }}
                className="flex-1 h-11 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteSubmitting}
                className="flex-1 h-11 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleteSubmitting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

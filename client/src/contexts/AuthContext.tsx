import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { getCurrentUser, login as apiLogin, register as apiRegister } from '../api';
import type { UserInfo } from '@shared/api.interface';
import { Preferences } from '@capacitor/preferences';
import { stopCollectMonitor } from '../utils/collectReminder';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    phone: string;
    nickname: string;
    password: string;
    avatarUrl?: string;
    inviteCode?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (newUser: UserInfo) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kuaimai_token';
const USER_CACHE_KEY = 'kuaimai_user_cache';

// 清除本应用在 localStorage 中的全部本地数据（切号/登出时彻底重置，杜绝串号）
function clearLocalStorageKuaimai(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('kuaimai_')) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

// 清除 Capacitor Preferences 原生存储中的本应用数据（H5 下其后端为 localStorage，同样安全）
async function clearPreferencesKuaimai(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('kuaimai_')).map((k) => Preferences.remove({ key: k })),
    );
  } catch {
    // 原生存储不可用时忽略，localStorage 已清理
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    // 先设置Authorization头
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // 先从本地缓存读取用户信息，立即显示
    const cachedUser = localStorage.getItem(USER_CACHE_KEY);
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
        setLoading(false);
      } catch (e) {
        // 缓存解析失败，忽略
      }
    }
    
    // 后台从服务器更新用户信息
    fetchUser();
    
    // 每5分钟定期刷新用户信息（确保级别等信息能更新）
    const refreshTimer = setInterval(() => {
      if (localStorage.getItem(TOKEN_KEY)) {
        fetchUser();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshTimer);
  }, []);

  async function fetchUser() {
    try {
      const data = await getCurrentUser();
      setUser(data as UserInfo);
      // 缓存用户信息到本地
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      const status = (error as { status?: number })?.status;
      // 401 = token 失效/过期：彻底清登录态，强制回登录页重新登录
      // （之前只在"无缓存用户"时才清 token，导致有缓存的用户卡在半登录态——页面在但所有 API 401，表现为"强退"）
      if (status === 401) {
        clearLocalStorageKuaimai();
        await clearPreferencesKuaimai().catch(() => {});
        delete axiosForBackend.defaults.headers.common['Authorization'];
        setUser(null);
        window.location.replace('/login');
        return;
      }
      // 其他（网络抖动/服务器5xx）：保留缓存用户，不退出，避免误踢
      logger.error('获取用户信息失败', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone: string, password: string) {
    const data = await apiLogin(phone, password);
    clearLocalStorageKuaimai();
    await clearPreferencesKuaimai();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
    setUser(data.user as UserInfo);
    window.location.replace('/');
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  }

  async function register(data: {
    phone: string;
    nickname: string;
    password: string;
    avatarUrl?: string;
    inviteCode?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }) {
    const result = await apiRegister(data);
    clearLocalStorageKuaimai();
    await clearPreferencesKuaimai();
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user));
    setUser(result.user as UserInfo);
    window.location.replace('/');
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
  }

  async function logout() {
    // 先停止原生收款提醒服务，避免登出后旧 token 继续轮询
    await stopCollectMonitor();
    clearLocalStorageKuaimai();
    delete axiosForBackend.defaults.headers.common['Authorization'];
    await clearPreferencesKuaimai();
    setUser(null);
    // 整页加载到登录页，彻底销毁旧运行时（组件状态、定时器、在途自动下单），杜绝切号残留
    window.location.replace('/login');
  }

  async function refreshUser() {
    await fetchUser();
  }

  // 直接更新用户信息（用于保存资料后立即更新状态，避免额外的网络请求）
  function updateUser(newUser: UserInfo) {
    setUser(newUser);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(newUser));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

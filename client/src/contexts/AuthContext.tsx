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
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (newUser: UserInfo) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kuaimai_token';
const USER_CACHE_KEY = 'kuaimai_user_cache';

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
      logger.error('获取用户信息失败', error);
      // 如果没有缓存用户，才清除token
      if (!localStorage.getItem(USER_CACHE_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(phone: string, password: string) {
    const data = await apiLogin(phone, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
    setUser(data.user as UserInfo);
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  }

  async function register(data: {
    phone: string;
    nickname: string;
    password: string;
    avatarUrl?: string;
    inviteCode?: string;
  }) {
    const result = await apiRegister(data);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user));
    setUser(result.user as UserInfo);
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    setUser(null);
    delete axiosForBackend.defaults.headers.common['Authorization'];
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

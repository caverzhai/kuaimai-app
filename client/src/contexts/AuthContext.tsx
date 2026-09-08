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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kuaimai_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    // 先设置Authorization头，再获取用户信息
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const data = await getCurrentUser();
      setUser(data as UserInfo);
    } catch (error) {
      logger.error('获取用户信息失败', error);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone: string, password: string) {
    const data = await apiLogin(phone, password);
    localStorage.setItem(TOKEN_KEY, data.token);
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
    setUser(result.user as UserInfo);
    axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    delete axiosForBackend.defaults.headers.common['Authorization'];
  }

  async function refreshUser() {
    await fetchUser();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
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

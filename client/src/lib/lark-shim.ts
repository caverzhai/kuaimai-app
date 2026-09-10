/**
 * 平台 SDK 垫片 - 本地构建时替换 @lark-apaas/client-toolkit
 * 提供 axiosForBackend 和 logger 的本地实现
 */
import React from 'react';

// 后端 API 基础地址 - 打包成APP后需要改为公网可访问的后端地址
// 开发时使用 localhost，生产部署后修改为你的服务器地址
const API_BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ||
  'https://backend-production-5d79.up.railway.app';

// 简单的 axios 替代实现（避免额外依赖）
// 设计为可调用函数对象：既支持 axiosForBackend({...}) 直接调用，也支持 axiosForBackend.get/post 等方法
interface AxiosConfig {
  url: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface AxiosResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

type AxiosInstance = {
  (config: AxiosConfig): Promise<AxiosResponse>;
  baseURL: string;
  defaults: { headers: { common: Record<string, string> } };
  get<T = unknown>(url: string, config?: Omit<AxiosConfig, 'url' | 'method'>): Promise<AxiosResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>): Promise<AxiosResponse<T>>;
  patch<T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>): Promise<AxiosResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>): Promise<AxiosResponse<T>>;
  delete<T = unknown>(url: string, config?: Omit<AxiosConfig, 'url' | 'method'>): Promise<AxiosResponse<T>>;
  request<T = unknown>(config: AxiosConfig): Promise<AxiosResponse<T>>;
};

async function sendRequest<T = unknown>(config: AxiosConfig): Promise<AxiosResponse<T>> {
  const baseURL = API_BASE_URL;
  let url = config.url.startsWith('http')
    ? config.url
    : `${baseURL}${config.url.startsWith('/') ? '' : '/'}${config.url}`;

  // 拼接 query 参数
  if (config.params) {
    const searchParams = new URLSearchParams();
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...axiosForBackend.defaults.headers.common,
    ...config.headers,
  };

  const method = (config.method || 'GET').toUpperCase();
  const response = await fetch(url, {
    method,
    headers,
    body:
      method !== 'GET' && config.data !== undefined
        ? JSON.stringify(config.data)
        : undefined,
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`HTTP ${response.status}: ${errorText || response.statusText}`) as Error & { response?: AxiosResponse };
    error.response = {
      data: errorText,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    };
    throw error;
  }

  const data = (await response.json().catch(() => ({}))) as T;
  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  };
}

// 创建可调用的函数对象
const axiosForBackend = ((config: AxiosConfig) => sendRequest(config)) as AxiosInstance;

// 挂载属性和方法
axiosForBackend.baseURL = API_BASE_URL;
axiosForBackend.defaults = {
  headers: {
    common: {} as Record<string, string>,
  },
};
axiosForBackend.request = <T = unknown>(config: AxiosConfig) => sendRequest<T>(config);
axiosForBackend.get = <T = unknown>(url: string, config?: Omit<AxiosConfig, 'url' | 'method'>) =>
  sendRequest<T>({ url, method: 'GET', ...config });
axiosForBackend.post = <T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>) =>
  sendRequest<T>({ url, method: 'POST', data, ...config });
axiosForBackend.patch = <T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>) =>
  sendRequest<T>({ url, method: 'PATCH', data, ...config });
axiosForBackend.put = <T = unknown>(url: string, data?: unknown, config?: Omit<AxiosConfig, 'url' | 'method' | 'data'>) =>
  sendRequest<T>({ url, method: 'PUT', data, ...config });
axiosForBackend.delete = <T = unknown>(url: string, config?: Omit<AxiosConfig, 'url' | 'method'>) =>
  sendRequest<T>({ url, method: 'DELETE', ...config });

// 简单的 logger 实现
export const logger = {
  log: (...args: unknown[]) => console.log('[kuaimai]', ...args),
  error: (...args: unknown[]) => console.error('[kuaimai]', ...args),
  warn: (...args: unknown[]) => console.warn('[kuaimai]', ...args),
  info: (...args: unknown[]) => console.info('[kuaimai]', ...args),
  debug: (...args: unknown[]) => console.debug('[kuaimai]', ...args),
};

export default { axiosForBackend, logger };

// getEnv 实现
export const getEnv = (key: string): string | undefined => {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
};

// AppContainer 组件 - 简单的主题提供者
export const AppContainer = (props: { children: unknown; defaultTheme?: string }) => {
  return React.createElement('div', { style: { width: '100%', minHeight: '100vh' } }, props.children);
};

// ErrorRender 组件 - 简单的错误显示
export const ErrorRender = (props: { error: Error; resetErrorBoundary?: () => void }) => {
  return React.createElement('div', { style: { padding: 20, color: 'red' } },
    React.createElement('h2', null, '应用出错了'),
    React.createElement('pre', null, props.error.message),
    props.resetErrorBoundary && React.createElement('button', { onClick: props.resetErrorBoundary }, '重试')
  );
};

// 类型导出
export type UserInfo = { id: string; name?: string; avatar?: string; [key: string]: unknown };
export type SearchAvatar = { avatar_url?: string; [key: string]: unknown };

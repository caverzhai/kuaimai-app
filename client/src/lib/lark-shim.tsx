/**
 * 平台 SDK 垫片 - 本地构建时替换 @lark-apaas/client-toolkit
 * 提供 axiosForBackend、logger、AppContainer、ErrorRender、getEnv 等本地实现
 */
import React from 'react';

// 后端 API 基础地址（注意：api/index.ts中的URL已包含/api前缀，所以这里不加）
const API_BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ||
  'https://backend-production-5d79.up.railway.app';

// 原生 HTTP 桥接接口类型声明
declare global {
  interface Window {
    NativeHttp?: {
      request: (url: string, method: string, headersJson: string, body: string | null) => string;
    };
  }
}

// axios 配置类型
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

// 发送请求的核心函数
async function sendRequest<T = unknown>(config: AxiosConfig): Promise<AxiosResponse<T>> {
  const baseURL = API_BASE_URL;
  let url = config.url.startsWith('http')
    ? config.url
    : `${baseURL}${config.url.startsWith('/') ? '' : '/'}${config.url}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...axiosForBackend.defaults.headers.common,
    ...config.headers,
  };

  const method = (config.method || 'GET').toUpperCase();

  // 优先使用原生HTTP桥接（通过Android原生层发起请求，完全绕过CORS）
  // 注意：每次请求都检测，因为接口可能在模块加载后才注册
  const nativeHttp = typeof window !== 'undefined' ? window.NativeHttp : undefined;
  if (nativeHttp && typeof nativeHttp.request === 'function') {
    try {
      // 构造请求头 JSON
      const headersObj: Record<string, string> = {};
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            headersObj[key] = String(value);
          }
        });
      }

      // 构造请求体
      let requestBody: string | null = null;
      if (method !== 'GET' && method !== 'HEAD' && config.data !== undefined && config.data !== null) {
        requestBody = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      }

      // 拼接 query 参数到 URL
      let finalUrl = url;
      if (config.params) {
        const searchParams = new URLSearchParams();
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
        }
      }

      // 调用原生HTTP桥接接口（同步调用，返回JSON字符串）
      const responseJson = nativeHttp.request(
        finalUrl,
        method,
        JSON.stringify(headersObj),
        requestBody
      );

      // 解析响应
      const response = JSON.parse(responseJson);
      const status = response.status ?? 0;
      const responseHeaders: Record<string, string> = response.headers ?? {};
      let responseData: unknown = response.data ?? '';

      // 尝试解析 JSON 响应体
      if (typeof responseData === 'string' && responseData) {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // 不是 JSON，保持原样
        }
      }

      if (status >= 400) {
        const errorText = typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData);
        const error = new Error(`HTTP ${status}: ${errorText} (URL: ${finalUrl})`) as Error & { response?: AxiosResponse };
        error.response = {
          data: responseData as T,
          status,
          statusText: response.statusText ?? '',
          headers: responseHeaders,
        };
        throw error;
      }

      return {
        data: responseData as T,
        status,
        statusText: response.statusText ?? '',
        headers: responseHeaders,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  // 降级：使用标准fetch（浏览器环境或原生桥接不可用时）
  // 拼接 query 参数
  let finalUrl = url;
  if (config.params) {
    const searchParams = new URLSearchParams();
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  // 请求超时控制（30秒），避免请求一直pending导致页面卡住
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(finalUrl, {
      method,
      headers,
      body:
        method !== 'GET' && config.data !== undefined
          ? JSON.stringify(config.data)
          : undefined,
      signal: controller.signal,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      
      // 尝试从服务器返回的错误中提取用户友好的消息
      let userMessage = '';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          userMessage = errorJson.message;
        } else if (errorJson.error?.message) {
          userMessage = errorJson.error.message;
        }
      } catch (e) {
        // 解析失败，使用原始错误文本
        userMessage = errorText;
      }
      
      // 如果没有提取到用户消息，使用默认错误消息
      if (!userMessage) {
        if (response.status === 409) {
          userMessage = '操作冲突，请稍后重试';
        } else if (response.status === 401) {
          userMessage = '登录已过期，请重新登录';
        } else if (response.status === 403) {
          userMessage = '没有权限执行此操作';
        } else if (response.status === 404) {
          userMessage = '请求的资源不存在';
        } else if (response.status >= 500) {
          userMessage = '服务器错误，请稍后重试';
        } else {
          userMessage = '请求失败，请稍后重试';
        }
      }
      
      const error = new Error(userMessage) as Error & { 
        response?: AxiosResponse;
        status?: number;
        rawError?: string;
      };
      error.response = {
        data: errorText,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };
      error.status = response.status;
      error.rawError = errorText;
      throw error;
    }

    const data = (await response.json().catch(() => ({}))) as T;
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(
          `请求超时（30秒）\n` +
          `URL: ${finalUrl}\n` +
          `方法: ${method}\n` +
          `请检查网络连接或服务器状态`
        );
      }
      // 网络错误（Failed to fetch等），添加详细信息
      if (!error.message.includes('URL:')) {
        throw new Error(
          `${error.message}\n` +
          `URL: ${finalUrl}\n` +
          `方法: ${method}\n` +
          `请检查网络连接或服务器状态`
        );
      }
      throw error;
    }
    throw new Error(String(error));
  } finally {
    clearTimeout(timeoutId);
  }
}

// 创建可调用的函数对象（既支持 axiosForBackend({...}) 直接调用，也支持 .get/.post 等方法）
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

// getEnv 实现
export const getEnv = (key: string): string | undefined => {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
};

// AppContainer 组件
export const AppContainer: React.FC<{
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark';
}> = ({ children }) => {
  return <div style={{ width: '100%', minHeight: '100vh' }}>{children}</div>;
};

// ErrorRender 组件
export const ErrorRender: React.FC<{
  error: Error;
  resetErrorBoundary?: () => void;
}> = ({ error, resetErrorBoundary }) => {
  return (
    <div style={{ padding: 20, color: 'red' }}>
      <h2>应用出错了</h2>
      <pre>{error.message}</pre>
      {resetErrorBoundary && (
        <button onClick={resetErrorBoundary}>重试</button>
      )}
    </div>
  );
};

// 类型导出
export type UserInfo = {
  id: string;
  name?: string;
  avatar?: string;
  [key: string]: unknown;
};

export type SearchAvatar = {
  avatar_url?: string;
  [key: string]: unknown;
};

export { axiosForBackend };
export default { axiosForBackend, logger, getEnv, AppContainer, ErrorRender };

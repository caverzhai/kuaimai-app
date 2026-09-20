import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AppContainer } from './lib/lark-shim.tsx';
import { ErrorRender } from './lib/lark-shim.tsx';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { initPreferencesCache } from './utils/preferences-cache';

const CLIENT_BASE_PATH = (import.meta as any).env?.VITE_CLIENT_BASE_PATH || '/';

// 配置API请求baseURL
// APP中使用本地文件，需要指向远程服务器；网页版使用相对路径（同域名）
const BACKEND_URL = 'https://backend-production-5d79.up.railway.app';
if ((window as any).Capacitor) {
  // 在Capacitor APP中运行，设置baseURL为远程服务器
  axiosForBackend.defaults.baseURL = BACKEND_URL;
  console.log('[APP] API baseURL set to:', BACKEND_URL);
} else {
  // 在网页版中运行，使用相对路径
  console.log('[Web] Using relative API paths');
}

const MainApp = () => {
  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <AppContainer defaultTheme="light">
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender
              error={error as Error}
              resetErrorBoundary={resetErrorBoundary}
            />
          )}
        >
          <RoutesComponent />
          {createPortal(<Toaster />, document.body)}
        </ErrorBoundary>
      </AppContainer>
    </BrowserRouter>
  );
};

// 立即渲染应用（使用localStorage中的缓存数据，lazy initial state会立即显示内容）
// 关键优化：先等待Preferences缓存同步到localStorage（最多500ms），确保APP重启后能立即显示上次缓存的数据
// 同步完成后再渲染，避免白屏和重复加载
(async () => {
  try {
    // 等待Preferences缓存初始化（从原生存储同步到localStorage）
    // 使用Promise.race设置500ms超时，避免极端情况下阻塞过久
    await Promise.race([
      initPreferencesCache(),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
    console.log('[App] 缓存同步完成，开始渲染');
  } catch (e) {
    console.error('[App] 缓存初始化失败，直接渲染', e);
  }

  // 渲染应用
  createRoot(document.getElementById('root')!).render(<MainApp />);
})();

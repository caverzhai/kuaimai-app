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
// 后台异步初始化Preferences原生存储，不阻塞首屏渲染
// localStorage中的数据在每次setCache时都会同步写入，所以已经是最新的
createRoot(document.getElementById('root')!).render(<MainApp />);

// 后台异步初始化Preferences缓存（从原生存储加载数据到内存）
// 不阻塞首屏渲染，初始化完成后如果有更新的数据会自动同步
initPreferencesCache().then(() => {
  console.log('[App] Preferences缓存初始化完成（后台）');
}).catch((e) => {
  console.error('[App] Preferences缓存初始化失败', e);
});

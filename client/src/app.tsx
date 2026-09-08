import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ProductDetailPage from './pages/ProductDetail/ProductDetailPage';
import MallOrderConfirmPage from './pages/MallOrderConfirm/MallOrderConfirmPage';
import MyOrdersPage from './pages/MyOrders/MyOrdersPage';
import ConsultantsPage from './pages/Consultants/ConsultantsPage';
import ConsultantDetailPage from './pages/ConsultantDetail/ConsultantDetailPage';
import ConsultOrdersPage from './pages/ConsultOrders/ConsultOrdersPage';
import MyTeamPage from './pages/MyTeam/MyTeamPage';
import InviteCodePage from './pages/InviteCode/InviteCodePage';
import FinancePage from './pages/Finance/FinancePage';
import SupplementInviterPage from './pages/SupplementInviter/SupplementInviter';
import AdminPage from './pages/Admin/AdminPage';
import ChatRoomDetailPage from './pages/ChatRoom/ChatRoomDetailPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  useEffect(() => {
    const token = localStorage.getItem('kuaimai_token');
    if (token) {
      axiosForBackend.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
          {/* 以下4个页面使用Layout中的缓存渲染，路由只用于路径匹配 */}
          <Route index element={<div />} />
          <Route path="mall" element={<div />} />
          <Route path="tasks" element={<div />} />
          <Route path="upgrade" element={<div />} />
          <Route path="profile" element={<div />} />
          <Route path="chat-rooms" element={<div />} />
          {/* 其他页面正常渲染 */}
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="consultants" element={<ConsultantsPage />} />
          <Route path="consultant/:id" element={<ConsultantDetailPage />} />
          <Route path="team" element={<MyTeamPage />} />
          <Route path="invite" element={<InviteCodePage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="supplement-inviter" element={<SupplementInviterPage />} />
          <Route path="my-orders" element={<MyOrdersPage />} />
          <Route path="order-confirm/:productId" element={<MallOrderConfirmPage />} />
          <Route path="consult-orders" element={<ConsultOrdersPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="chat-room/:roomId" element={<ChatRoomDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default RoutesComponent;

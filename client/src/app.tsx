import { useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import GlobalUpdateCheck from './components/GlobalUpdateCheck';
import { ErrorBoundary } from './components/ErrorBoundary';
import SplashPage from './pages/Splash/SplashPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import MallPage from './pages/Mall/MallPage';
import ChatRoomListPage from './pages/ChatRoom/ChatRoomListPage';
import TaskCenterPage from './pages/TaskCenter/TaskCenterPage';
import ProfilePage from './pages/Profile/ProfilePage';
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
import SellerOrdersPage from './pages/Seller/SellerOrdersPage';
import SellerFeesPage from './pages/Seller/SellerFeesPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('kuaimai_token');
    if (token) {
      axiosForBackend.defaults.headers.common['Authorization'] = 'Bearer ' + token;
    }
  }, []);

  // APP模式下首次进入自动跳转开机图
  useEffect(() => {
    if ((window as any).Capacitor && location.pathname === '/') {
      if (!sessionStorage.getItem('splash_shown')) {
        sessionStorage.setItem('splash_shown', '1');
        navigate('/splash', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return (
    <ErrorBoundary>
      <GlobalUpdateCheck />
      <AuthProvider>
        <Routes>
          {/* 全屏页面（无Layout） */}
          <Route path="splash" element={<SplashPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot" element={<ForgotPasswordPage />} />
          <Route path="chat-room/:roomId" element={<ChatRoomDetailPage />} />

          {/* 带顶部栏+底部Dock的主框架，Outlet渲染当前页面 */}
          <Route element={<Layout />}>
            <Route index element={<MallPage />} />
            <Route path="mall" element={<Navigate to="/" replace />} />
            <Route path="chat-rooms" element={<ChatRoomListPage />} />
            <Route path="tasks" element={<TaskCenterPage />} />
            <Route path="upgrade" element={<TaskCenterPage />} />
            <Route path="profile" element={<ProfilePage />} />
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
            <Route path="seller/orders" element={<SellerOrdersPage />} />
            <Route path="seller/fees" element={<SellerFeesPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default RoutesComponent;
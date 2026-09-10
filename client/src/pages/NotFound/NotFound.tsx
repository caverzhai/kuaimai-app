import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl md:text-9xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          404
        </h1>
        <p className="mt-4 text-xl font-semibold text-gray-800">页面不存在</p>
        <p className="mt-2 text-sm text-gray-500">
          您访问的页面可能已被移除或链接有误
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-sm transition-colors"
        >
          <Home size={18} />
          返回首页
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;

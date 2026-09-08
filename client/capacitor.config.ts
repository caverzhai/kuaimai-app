import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuaimai.app',
  appName: '快卖',
  webDir: 'dist',
  bundledWebRuntime: false,
  // 移除server.url，使用本地打包的前端文件，大幅提升APP加载速度和响应速度
  // API请求通过axiosForBackend指向远程服务器
  androidScheme: 'https',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#f97316',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#f97316',
    },
  },
};

export default config;

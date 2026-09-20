import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuaimai.app',
  appName: '快卖',
  version: '2.24.4',
  webDir: 'dist',
  bundledWebRuntime: false,
  // 显式使用http scheme，确保本地文件正常加载
  androidScheme: 'http',
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

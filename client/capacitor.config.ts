import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuaimai.app',
  appName: 'AI快卖',
  version: '2.58.0',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#1a0a00',
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

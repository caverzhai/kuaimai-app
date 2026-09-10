import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // 部署在根路径下
  base: '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@client', replacement: path.resolve(__dirname, '.') },
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: '@server', replacement: path.resolve(__dirname, '../server') },
      // 平台 SDK 本地垫片 - 正则匹配所有子路径
      { find: /^@lark-apaas\/client-toolkit.*$/, replacement: path.resolve(__dirname, './src/lib/lark-shim.tsx') },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api/rtrvr': {
          target: 'https://api.rtrvr.ai',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/rtrvr/, ''),
          secure: true,
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'VITE_SPEECHMATICS_API_KEY': JSON.stringify('2HFb4voFW19Do6Euo96s96roD7pZUCFe')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

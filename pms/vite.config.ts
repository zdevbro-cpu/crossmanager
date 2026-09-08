import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // A안: 로컬 PMS가 배포 API를 사용하도록 프록시 타겟을 바꿀 수 있음
  // - 로컬 서버: http://localhost:3007
  // - 배포 서버: https://crossmanager.web.app  (권장: same hosting rewrite)
  // 기본값을 배포로 두면, 로컬에서 업로드한 파일도 배포(=버킷) 기준으로 확인 가능
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://crossmanagern.web.app'

  return {
    base: '/pms/',
    plugins: [react()],
    publicDir: 'public',
    server: {
      port: 5176,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})

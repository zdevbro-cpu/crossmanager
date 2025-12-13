
import axios from 'axios'

// API 서버 기본 URL (환경 변수 또는 기본값)
// API 서버 기본 URL (환경 변수 또는 기본값)
// API Base URL
// - Prod: Hosting rewrite(/api/** -> function api) uses same-origin '/api'
// - Dev: Use '/api' and let Vite proxy decide target (local server or deployed)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Axios 인스턴스 생성
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// 요청 인터셉터 (예: 인증 토큰 추가)
apiClient.interceptors.request.use(
    (config) => {
        // TODO: Firebase Auth 토큰 등을 헤더에 추가하는 로직 필요
        // const token = await auth.currentUser?.getIdToken()
        // if (token) config.headers.Authorization = `Bearer ${token}`
        return config
    },
    (error) => Promise.reject(error)
)

// buildFileUrl 함수 추가
export const buildFileUrl = (path: string) => {
    let base = apiClient.defaults.baseURL || '/api'

    // Fix: If path is 'uploads/...', it should be served from root, not /api/uploads
    // If base ends with '/api', strip it for upload paths
    if ((path.startsWith('uploads/') || path.startsWith('/uploads/')) && base.endsWith('/api')) {
        base = base.slice(0, -4) // remove /api
    }

    const baseAbsolute = base.startsWith('http')
        ? base
        : `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`

    const baseTrimmed = baseAbsolute.replace(/\/+$/, '')
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${baseTrimmed}${normalizedPath}`
}

// 응답 인터셉터 (예: 에러 처리)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)

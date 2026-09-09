import axios from 'axios'

// API 서버 기본 URL (환경 변수 또는 기본값)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Axios 인스턴스 생성
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// 요청 인터셉터
apiClient.interceptors.request.use(
    (config) => {
        try {
            const stored = localStorage.getItem('ems-local-user')
            if (stored) {
                const user = JSON.parse(stored)
                if (user.role) {
                    config.headers['x-user-role'] = user.role
                }
            }
        } catch (e) {
            // ignore
        }
        return config
    },
    (error) => Promise.reject(error)
)

// 응답 인터셉터
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)

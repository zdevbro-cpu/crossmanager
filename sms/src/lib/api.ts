import axios from 'axios'
import { auth } from './firebase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 8000)

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number.isFinite(API_TIMEOUT_MS) ? API_TIMEOUT_MS : 8000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  async (config) => {
    const token = await auth?.currentUser?.getIdToken?.()
    if (token) {
      const headers = config.headers ?? {}
        ; (headers as Record<string, string>).Authorization = `Bearer ${token}`
      config.headers = headers
    }
    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  },
)

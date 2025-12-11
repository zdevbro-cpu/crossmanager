import axios from 'axios'

// API Base URL (defaults to local dev)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api'

// Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

// Build absolute URL for files served via the API (e.g., /api/uploads/...)
export const buildFileUrl = (path?: string) => {
  if (!path) return '#'
  if (/^https?:\/\//i.test(path)) return path

  const base = apiClient.defaults.baseURL || '/api'
  const baseAbsolute = base.startsWith('http')
    ? base
    : `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`

  const baseTrimmed = baseAbsolute.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseTrimmed}${normalizedPath}`
}

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // TODO: attach auth token if needed
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

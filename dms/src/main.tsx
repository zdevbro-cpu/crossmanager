import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './hooks/useAuth.tsx'

// App 이 Routes·NavLink 를 쓰고 ProjectContext 가 react-query 를 쓴다.
// 둘 다 여기서 감싸 주지 않으면 화면이 통째로 비어 버린다.
// 목업 시절 진입점에는 이 껍데기가 없어 복구 후 렌더링이 되지 않았다.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    </StrictMode>,
)

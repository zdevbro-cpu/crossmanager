import { createContext, useContext, useMemo, useState } from 'react'

type ToastType = 'info' | 'success' | 'error' | 'warning'
type Toast = { id: string; message: string; type: ToastType }

type ToastContextValue = {
  toasts: Toast[]
  show: (message: string, type?: ToastType, durationMs?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = (message: string, type: ToastType = 'info', durationMs = 3200) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), durationMs)
  }

  const value = useMemo(() => ({ toasts, show }), [toasts])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider 안에서만 useToast를 호출할 수 있습니다.')
  return ctx
}

export function ToastViewport() {
  const { toasts } = useToast()
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

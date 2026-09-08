import { Navigate, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import Spinner from './Spinner'
import { useAuth } from '../hooks/useAuth'

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export default RequireAuth

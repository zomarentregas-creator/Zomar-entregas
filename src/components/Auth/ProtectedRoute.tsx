// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../Layout/Layout'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('entrepreneur' | 'deliverer' | 'admin')[]
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user || !user.role) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={
          user.role === 'entrepreneur'
            ? '/entrepreneur-dashboard'
            : user.role === 'deliverer'
            ? '/deliverer/dashboard'
            : '/admin/dashboard'
        }
        replace
      />
    )
  }

  return <Layout userType={user.role}>{children}</Layout>
}

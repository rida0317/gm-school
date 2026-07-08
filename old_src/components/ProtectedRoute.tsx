// src/components/ProtectedRoute.tsx - Protected route wrapper with role-based access control

import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import type { UserRole } from '../types'
import type { Permissions } from '../config/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requiredPermission?: keyof Permissions
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission
}) => {
  const { user, loading, userData, hasPermission, isRole, logout } = useAuth()
  const location = useLocation()
  const [forceLoaded, setForceLoaded] = useState(false)

  // Safety timeout: Force load after 10 seconds to prevent infinite loading loop
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('⚠️ Auth loading timeout reached. Forcing load.')
        setForceLoaded(true)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Show loading while checking auth (unless forced)
  if (loading && !forceLoaded) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '1rem'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid var(--border-color)',
          borderTop: '5px solid var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '1.2rem', color: 'var(--primary-color)', fontWeight: 600 }}>
          ⏳ Chargement...
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 🛡️ SECURITY CHECK: Account Status
  if (userData && userData.status !== 'active') {
    const statusMessage = userData.status === 'pending'
      ? '⏳ Votre compte est en attente de validation par l\'administration.'
      : '❌ Votre compte est suspendu. Veuillez contacter l\'administrateur.';

    return (
      <Navigate
        to="/login"
        state={{ error: statusMessage }}
        replace
      />
    )
  }

  // Check if user has required role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!userData?.role || !isRole(allowedRoles)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            message: '❌ Vous n\'avez pas les permissions nécessaires pour accéder à cette page.',
            requiredRoles: allowedRoles,
            userRole: userData?.role
          }}
          replace
        />
      )
    }
  }

  // Check if user has required permission
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            message: '❌ Vous n\'avez pas les permissions nécessaires pour accéder à cette page.',
            requiredPermission,
            userRole: userData?.role
          }}
          replace
        />
      )
    }
  }

  return <>{children}</>
}

export default ProtectedRoute


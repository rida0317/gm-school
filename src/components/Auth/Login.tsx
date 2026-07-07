// src/components/Auth/Login.tsx - Login page component

import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useSchoolStore } from '../../store/schoolStore'

import logger from '../../utils/logger'
import './Auth.css'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, logout, user, getUserStatus, userData } = useAuth()
  const { schoolName, logo } = useSchoolStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Set error if redirected from ProtectedRoute
  React.useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error)
      // Clear state so it doesn't persist on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location])

  // Show success message from signup
  const [successMessage, setSuccessMessage] = useState('')
  React.useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      // Clear state after showing
      window.history.replaceState({}, document.title)
    }
  }, [location])

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && userData) {
      logger.log('✅ User and data loaded, checking status...', userData.status)
      const status = userData.status

      if (status === 'suspended') {
        logger.log('❌ Account suspended')
        setError('❌ Votre compte a été suspendu. Contactez l\'administrateur.')
        logout() // 🛡️ Force logout
        return
      }

      if (status === 'pending') {
        logger.log('⏳ Account pending')
        setError('⏳ Votre compte est en attente de validation par l\'administration.')
        return
      }

      logger.log('✅ Account active, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [user, userData, navigate, logout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')



    setLoading(true)

    logger.log('🔐 Starting login for:', email)

    try {
      await login(email, password)
      

      
      logger.log('✅ Login successful')
      // Don't wait - useEffect will handle navigation when user state updates
    } catch (err: any) {
      logger.error('❌ Login error:', err)
      
      let errorMessage = 'Failed to login'

      // Network errors
      if (err.code === 'network-error' || err.message?.includes('Network error')) {
        errorMessage = '❌ Network error. Check your internet connection and Supabase configuration.\n\n📝 Make sure:\n- Your internet is working\n- .env.local has correct Supabase URL\n- Supabase project is active'
      }
      // Email not confirmed
      else if (err.code === 'email_not_confirmed') {
        errorMessage = '❌ Email not verified. Please check your inbox and click the verification link.\n\nIf you can\'t access the email, contact an administrator.'
      }
      // Supabase error codes
      else if (err.code === 'auth/user-not-found' || err.code === 'PGRST116') {
        errorMessage = '❌ Cet email n\'existe pas. Créez un compte d\'abord.'
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = '❌ Mot de passe incorrect'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = '❌ Email invalide'
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = '❌ Compte désactivé'
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = '❌ Trop de tentatives. Réessayez plus tard.'
      } else if (err.code === 'POSTGREST_CLIENT_ERROR') {
        errorMessage = '❌ Database error. Check your Supabase schema.'
      } else if (err.message) {
        errorMessage = `❌ ${err.message}`
      }

      setError(errorMessage)
    } finally {
      logger.log('📝 Login attempt finished')
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <img
              src={logo || "https://cdn-icons-png.flaticon.com/512/2859/2859706.png"}
              alt="Logo"
              className="auth-logo"
            />
            <h1 className="auth-title">{schoolName || 'Les Generations Montantes'}</h1>
            <p className="auth-subtitle">Système de Gestion Scolaire</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <h2 className="form-title">Login to Your Account</h2>

            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="loginEmail">Email Address</label>
              <input
                id="loginEmail"
                name="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="loginPassword">Password</label>
              <input
                id="loginPassword"
                name="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? '⏳ Logging in...' : '🔐 Login'}
            </button>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/signup" className="auth-link">
                  Sign Up
                </Link>
              </p>
              <p>
                <Link to="/forgot-password" className="auth-link">
                  Forgot Password?
                </Link>
              </p>
              <button 
                type="button" 
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="btn-text"
                style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7 }}
              >
                🔄 Reset Session (Click if stuck)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login


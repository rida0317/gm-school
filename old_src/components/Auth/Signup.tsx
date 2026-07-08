// src/components/Auth/Signup.tsx - Signup page component

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useSchoolStore } from '../../store/schoolStore'
import { validateEmail, validatePassword } from '../../utils/validation'
import type { UserRole } from '../../types'
import './Auth.css'

const Signup: React.FC = () => {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const { schoolName, logo } = useSchoolStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 🛡️ Data Validation
    if (!displayName.trim()) {
      setError('Veuillez entrer votre nom complet')
      return
    }

    if (!validateEmail(email)) {
      setError('Veuillez entrer une adresse email valide')
      return
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.isValid) {
      setError(passwordCheck.message || 'Le mot de passe est trop court')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)

    try {
      await signup(email, password, displayName, role)


      // Direct redirect to dashboard after signup (auto-login handled in AuthContext)
      setSuccessMessage('✅ Compte créé avec succès! Redirection...')

      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const [successMessage, setSuccessMessage] = useState('')

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
            <h2 className="form-title">Create Your Account</h2>

            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="signupName">Full Name</label>
              <input
                id="signupName"
                name="displayName"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                required
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signupEmail">Email Address</label>
              <input
                id="signupEmail"
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
              <label className="form-label" htmlFor="signupPassword">Password</label>
              <input
                id="signupPassword"
                name="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Letters and numbers only (min 8 characters)"
                required
                autoComplete="new-password"
                minLength={8}
                pattern="[A-Za-z0-9]{8,}"
                title="Password must contain only letters and numbers (at least 8 characters)"
              />
              <p className="password-hint">
                💡 Must contain: uppercase letter, lowercase letter, number (no special characters)
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signupConfirm">Confirm Password</label>
              <input
                id="signupConfirm"
                name="confirmPassword"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signupRole">Role</label>
              <select
                id="signupRole"
                name="role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
              >
                <option value="teacher">👨‍🏫 Professeur</option>
                <option value="director">👨‍💼 Directeur</option>
                <option value="guard">👮 Garde</option>
                <option value="admin">👑 Administrateur</option>
              </select>
              <p className="role-hint">
                {role === 'admin' && '👑 Accès complet à tous les modules'}
                {role === 'director' && '👨‍💼 Accès complet à la gestion de l\'école'}
                {role === 'teacher' && '👨‍🏫 Accès aux notes, classes et élèves'}
                {role === 'guard' && '👮 Accès à tous les modules sauf les paiements'}
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? '⏳ Creating account...' : '✨ Create Account'}
            </button>

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <Link to="/login" className="auth-link">
                  Login
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Signup


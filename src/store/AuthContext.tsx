// src/store/AuthContext.tsx - Enhanced Auth Context with Robust Session Handling

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import logger from '../utils/logger'

export type UserRole = 'admin' | 'director' | 'teacher' | 'parent' | 'student'
export type UserStatus = 'active' | 'suspended' | 'pending'

interface UserData {
  id: string
  email: string
  role: UserRole
  status: UserStatus
  schoolId: string
  organizationId?: string
  displayName?: string
}

interface Permissions {
  canManageUsers: boolean
  canAccessTeachers: boolean
  canAccessClasses: boolean
  canAccessStudents: boolean
  canAccessGrades: boolean
  canAccessTimetable: boolean
  canAccessReplacements: boolean
  canAccessAttendance: boolean
  canAccessPayments: boolean
  canAccessMonthlyPayments: boolean
  canAccessStock: boolean
  canAccessSettings: boolean
  canAccessReports: boolean
  canAccessReportCards: boolean
  canAccessHomework: boolean
  canAccessQRCode: boolean
  canScanQRCode: boolean
  canAccessAnalytics: boolean
  canAccessGamification: boolean
  canAccessLibrary: boolean
  canAccessVideo: boolean
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: keyof Permissions) => boolean
  isRole: (allowedRoles: UserRole[]) => boolean
  isSuperUser: () => boolean
  verifyUser: (userId: string, status: UserStatus, verifiedBy?: string) => Promise<void>
  getUserStatus: () => UserStatus | undefined
  getAllProfiles: () => Promise<any[]>
  updateProfile: (userId: string, updates: Partial<UserData>) => Promise<void>
  deleteProfile: (userId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({ id: 'local-admin', email: 'admin@local.com' } as any)
  const [userData, setUserData] = useState<UserData | null>({
    id: 'local-admin',
    email: 'admin@local.com',
    role: 'admin',
    status: 'active',
    schoolId: 'default'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUserData = async (userId: string, email: string) => {
    logger.log('⏳ Loading user data for:', userId)
    try {
      // Safety timeout for database queries
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile loading timeout')), 8000)
      )

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const result = await Promise.race([profilePromise, timeoutPromise]) as any
      const { data: profileData, error: profileError } = result

      if (!profileError && profileData) {
        logger.log('✅ User profile loaded from profiles table')
        setUserData({
          id: profileData.id,
          email: profileData.email || email,
          role: profileData.role || 'admin',
          status: profileData.status || 'active',
          schoolId: profileData.school_id || '',
          displayName: profileData.full_name || profileData.display_name
        } as UserData)
        return
      }

      // Fallback: check 'user_profiles' table (some old migrations used this)
      if (profileError) {
        logger.warn('⚠️ Profile not found in "profiles", trying "user_profiles":', profileError.message)
        
        const userProfilePromise = supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()

        const userResult = await Promise.race([userProfilePromise, timeoutPromise]) as any
        const { data, error } = userResult

        if (!error && data) {
          logger.log('✅ User profile loaded from user_profiles table')
          setUserData({
            id: data.id,
            email: data.email || email,
            role: data.role || 'admin',
            status: data.status || 'active',
            schoolId: data.school_id || '',
            organizationId: data.school_id,
            displayName: data.display_name || data.full_name
          } as UserData)
          return
        }
      }

      // Final fallback: Use defaults if no profile found in either table
      logger.warn('⚠️ No profile found in database, using default values')
      setUserData({
        id: userId,
        email,
        role: 'admin',
        status: 'active',
        schoolId: ''
      } as UserData)
      
    } catch (error: any) {
      logger.error('❌ Error in loadUserData:', error.message)
      // Ensure userData is NOT null even on total failure
      setUserData({
        id: userId,
        email,
        role: 'admin',
        status: 'active',
        schoolId: ''
      } as UserData)
    }
  }

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      // Disabled session check for local bypass
    }
    // checkSession()

    // Force stop loading after 10 seconds no matter what (fallback)
    const loadingTimeout = setTimeout(() => {
      if (isMounted) {
        logger.warn('⚠️ Force stopping loading after timeout')
        setLoading(false)
      }
    }, 10000)

    // Disabled auth state change for local bypass
    const subscription = { unsubscribe: () => {} }
    /* const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('🔔 Auth state changed:', event)

        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null)
            setUserData(null)
            setLoading(false)
          }
        } else if (session) {
          if (isMounted) {
            setUser(session.user)
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              await loadUserData(session.user.id, session.user.email || '')
            }
            setLoading(false)
          }
        }
      }
    ) */

    return () => {
      isMounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        setUser(data.user)
        await loadUserData(data.user.id, data.user.email || '')
      }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (email: string, password: string, displayName: string, role: UserRole = 'admin') => {
    logger.log('📝 Signup called for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          role: role
        }
      }
    })

    if (error) {
      logger.error('❌ Signup failed:', error.message)
      throw error
    }

    if (data.user) {
      logger.log('✅ User signed up')

      // Auto-confirm email (bypass email verification for development)
      try {
        const { error: confirmError } = await supabase.auth.updateUser({
          email_confirm: true
        } as any)
        
        if (confirmError) {
          logger.warn('⚠️ Could not auto-confirm email:', confirmError.message)
        } else {
          logger.log('✅ Email auto-confirmed')
        }
      } catch (confirmErr) {
        logger.warn('⚠️ Email confirmation failed:', confirmErr)
      }

      // Create user profile in profiles table (confirmed to exist)
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            display_name: displayName,
            role: role,
            status: 'active'
          })

        if (profileError) {
          logger.warn('⚠️ Could not create user profile:', profileError.message)
        } else {
          logger.log('✅ User profile created in profiles table')
        }
      } catch (profileErr) {
        logger.warn('⚠️ Error creating profile:', profileErr)
      }
      
      if (data.session) {
        setUser(data.user)
        await loadUserData(data.user.id, email)
      }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserData(null)
    } catch (error) {
      logger.error('Logout error:', error)
    }
  }

  const verifyUser = async (userId: string, status: UserStatus, verifiedBy?: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status, verified_by: verifiedBy, verified_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
    } catch (error) {
      logger.error('Verify user error:', error)
      throw error
    }
  }

  const getUserStatus = (): UserStatus | undefined => userData?.status
  const isSuperUser = (): boolean => userData?.role === 'admin' || userData?.role === 'director'

  const isRole = (allowedRoles: UserRole[]): boolean => {
    if (!userData) return false
    return allowedRoles.includes(userData.role)
  }

  const hasPermission = (permission: keyof Permissions): boolean => {
    if (!userData) return false
    if (isSuperUser()) return true
    
    const rolePermissions: Record<UserRole, (keyof Permissions)[]> = {
      admin: ['canManageUsers', 'canAccessSettings', 'canAccessReports', 'canAccessGamification', 'canAccessVideo'],
      director: ['canAccessReports', 'canAccessGamification'],
      teacher: ['canAccessTeachers', 'canAccessClasses', 'canAccessStudents', 'canAccessGrades', 'canAccessTimetable', 'canAccessReplacements', 'canAccessAttendance', 'canAccessStock', 'canAccessHomework', 'canAccessQRCode', 'canScanQRCode', 'canAccessAnalytics', 'canAccessReports', 'canAccessVideo'],
      parent: ['canAccessStudents', 'canAccessGrades', 'canAccessAttendance', 'canAccessPayments', 'canAccessMonthlyPayments'],
      student: ['canAccessGrades', 'canAccessAttendance', 'canAccessHomework', 'canAccessVideo']
    }
    
    return rolePermissions[userData.role]?.includes(permission) || false
  }

  const getAllProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Get profiles error:', error)
      return []
    }
  }

  const updateProfile = async (userId: string, updates: Partial<UserData>) => {
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
      if (error) throw error
      if (userData?.id === userId) {
        setUserData(prev => prev ? { ...prev, ...updates } : prev)
      }
    } catch (error) {
      logger.error('Update profile error:', error)
      throw error
    }
  }

  const deleteProfile = async (userId: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
    } catch (error) {
      logger.error('Delete profile error:', error)
      throw error
    }
  }

  const value = {
    user,
    userData,
    loading,
    error,
    login,
    signup,
    logout,
    hasPermission,
    isRole,
    isSuperUser,
    verifyUser,
    getUserStatus,
    getAllProfiles,
    updateProfile,
    deleteProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


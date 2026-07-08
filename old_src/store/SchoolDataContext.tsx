// src/store/SchoolDataContext.tsx - School Data Context Provider (Supabase Version)

import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { useSchoolStore } from './schoolStore'
import { supabase } from '../lib/supabaseClient'

interface SchoolDataContextType {
  syncWithCloud: boolean
  enableCloudSync: () => void
  disableCloudSync: () => void
}

const SchoolDataContext = createContext<SchoolDataContextType | undefined>(undefined)

export function SchoolDataProvider({ children }: { children: ReactNode }) {
  const { user, userData } = useAuth()
  const { setSchoolInfo, setLanguage } = useSchoolStore()

  useEffect(() => {
    // Only fetch if user is logged in
    if (!user || !userData) return

    let isMounted = true

    // Fetch school data from Supabase
    const fetchSchoolData = async () => {
      try {


        // Use organizationId from userData or fetch from profiles
        const schoolId = userData?.organizationId || (user as any).school_id || '00000000-0000-0000-0000-000000000001'

        // Get school details
        const { data: school, error: schoolError } = await supabase
          .from('schools')
          .select('name, logo_url, settings, academic_year')
          .eq('id', schoolId)
          .single()

        if (schoolError) {
          console.warn('⚠️ School not found, using defaults:', schoolError.message)
          // Set default school info
          if (isMounted) {
            setSchoolInfo('Les Generations Montantes', '', undefined, true)
          }
          return
        }

        // Update Zustand store (skipSave=true to avoid re-saving to Supabase)
        if (school && isMounted) {
          setSchoolInfo(school.name, school.logo_url || '', school.academic_year, true)

          // Parse settings if exists
          if (school.settings) {
            const settings = school.settings
            if (settings.language) {
              setLanguage(settings.language)
            }
          }

        }
      } catch (error) {
        console.error('❌ Error in SchoolDataContext:', error)
        // Set default on error
        if (isMounted) {
          setSchoolInfo('Les Generations Montantes', '', undefined, true)
        }
      }
    }

    fetchSchoolData()

    return () => {
      isMounted = false
    }
  }, [user, userData]) // Re-run when hydration is complete

  const value = {
    syncWithCloud: !!user,
    enableCloudSync: () => {},
    disableCloudSync: () => {}
  }

  return (
    <SchoolDataContext.Provider value={value}>
      {children}
    </SchoolDataContext.Provider>
  )
}

export function useSchoolData() {
  const context = useContext(SchoolDataContext)
  if (context === undefined) {
    throw new Error('useSchoolData must be used within a SchoolDataProvider')
  }
  return context
}


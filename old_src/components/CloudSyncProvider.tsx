/**
 * Cloud Sync Component - Auto-migrates data on login
 * 
 * Add this to AuthContext to enable automatic cloud sync
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { cloudSync } from '../services/cloudSync'
import { migrateToCloud, needsMigration } from '../services/migration'

interface CloudSyncProviderProps {
  children: React.ReactNode
}

export function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { user, userData } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [syncComplete, setSyncComplete] = useState(false)

  useEffect(() => {
    if (!user || !userData) return

    const initializeSync = async () => {

      setIsSyncing(true)

      try {
        // Get school ID from user data or fetch from profile
        let schoolId = userData.organizationId

        if (!schoolId) {
          // Fetch from profiles
          const { data: profile } = await import('../lib/supabaseClient').then(m => m.supabase)
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()
          
          schoolId = profile?.school_id
        }

        if (!schoolId) {
          console.warn('⚠️ No school ID found, cloud sync disabled')
          setIsSyncing(false)
          return
        }

        // Initialize cloud sync
        cloudSync.initialize(user.id, schoolId)

        // Check if migration is needed
        if (needsMigration()) {

          setMigrationNeeded(true)
          
          // Auto-migrate
          const result = await migrateToCloud(user.id, schoolId)
          
          if (result.success) {


          } else {
            console.error('❌ Migration failed:', result.errors)
          }
        } else {

        }

        setSyncComplete(true)

      } catch (error) {
        console.error('❌ Cloud sync initialization failed:', error)
      } finally {
        setIsSyncing(false)
      }
    }

    initializeSync()

    // Cleanup on logout
    return () => {
      cloudSync.cleanup()
    }
  }, [user, userData])

  // Show syncing indicator if needed
  if (isSyncing && !syncComplete) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontSize: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>☁️</div>
          <div>Syncing with cloud...</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            Please wait
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Hook to check cloud sync status
 */
export function useCloudSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for sync events
  useEffect(() => {
    const handleSync = () => setLastSync(new Date())
    
    window.addEventListener('cloud-sync:complete', handleSync)
    
    return () => {
      window.removeEventListener('cloud-sync:complete', handleSync)
    }
  }, [])

  return {
    isOnline,
    lastSync,
    isSyncing: false
  }
}


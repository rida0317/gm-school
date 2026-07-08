// src/store/notificationsStore.ts - Notifications store (Supabase Version)
// Enhanced version with auto-notifications for timetable changes, replacements, and messages

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabaseClient'
import type { Notification } from '../types'


export interface NotificationWithId extends Notification {
  id: string
}

interface NotificationsState {
  notifications: NotificationWithId[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  isDesktopEnabled: boolean
}

interface NotificationsActions {
  // Manual actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  
  // Auto-notification helpers
  addTimetableChangeNotification: (className: string, day: string, slotIndex: number, changeType: 'added' | 'removed' | 'modified', subject?: string) => void
  addReplacementNotification: (className: string, originalTeacher: string, substituteTeacher: string, date: string, subject?: string) => void
  addMessageNotification: (senderName: string, subject: string, preview: string) => void
  addAnnouncementNotification: (title: string, content: string, audience?: string) => void
  
  // State management
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  subscribeToNotifications: (userId: string) => () => void
  refreshNotifications: () => void
  requestDesktopPermission: () => Promise<boolean>
  setDesktopEnabled: (enabled: boolean) => void
}

export type NotificationsStore = NotificationsState & NotificationsActions

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  lastUpdated: null,
  isDesktopEnabled: false
}

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== MANUAL ACTIONS ==========
      
      addNotification: async (notification) => {
        const newNotification: NotificationWithId = {
          ...notification,
          id: generateId(),
          timestamp: new Date().toISOString(),
          read: false
        }

        const schoolId = 'default'

        // Save to Supabase
        try {
          const { error } = await supabase
            .from('notifications')
            .insert({
              id: newNotification.id,
              school_id: schoolId,
              user_id: notification.userId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              timestamp: new Date().toISOString(),
              read: false,
              priority: notification.priority,
              action_url: notification.actionUrl,
              deleted: false
            })

          if (error) {
            if (error.code === '42P01') {
              console.warn('⚠️ notifications table does not exist. Notification saved locally only.')
            } else {
              console.error('Error saving notification to Supabase:', error)
            }
          }
        } catch (error) {
          console.error('Error saving notification:', error)
        }

        // Update local state
        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
          lastUpdated: new Date()
        }))

        // Show browser notification if enabled
        const { isDesktopEnabled } = get()
        if (isDesktopEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new window.Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: newNotification.id,
            requireInteraction: notification.priority === 'urgent',
            silent: notification.priority !== 'urgent'
          })
        }

        // Dispatch custom event for toast
        const toastType = notification.type === 'timetable_change' || notification.type === 'replacement' ? 'info' :
                         notification.priority === 'urgent' ? 'warning' : 'success'

        window.dispatchEvent(new CustomEvent('toast-added', {
          detail: {
            id: newNotification.id,
            message: `${notification.title}: ${notification.message}`,
            type: toastType,
            duration: 5000
          }
        }))
      },

      markAsRead: async (notificationId) => {
        try {
          const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)

          if (error) {
            console.error('Error marking notification as read in Supabase:', error)
          }

          set((state) => ({
            notifications: state.notifications.map(n =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }))
        } catch (error) {
          console.error('Error marking notification as read:', error)
          // Fallback: update local state only
          set((state) => ({
            notifications: state.notifications.map(n =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }))
        }
      },

      markAllAsRead: async () => {
        try {
          const { notifications } = get()
          const unreadNotifications = notifications.filter(n => !n.read)

          const notificationIds = unreadNotifications.map(n => n.id)
          
          if (notificationIds.length > 0) {
            const { error } = await supabase
              .from('notifications')
              .update({ read: true })
              .in('id', notificationIds)

            if (error) {
              console.error('Error marking all notifications as read in Supabase:', error)
            }
          }

          set((state) => ({
            notifications: state.notifications.map(n => ({ ...n, read: true })),
            unreadCount: 0
          }))
        } catch (error) {
          console.error('Error marking all notifications as read:', error)
          // Fallback: update local state only
          set((state) => ({
            notifications: state.notifications.map(n => ({ ...n, read: true })),
            unreadCount: 0
          }))
        }
      },

      deleteNotification: async (notificationId) => {
        try {
          const { error } = await supabase
            .from('notifications')
            .update({ deleted: true })
            .eq('id', notificationId)

          if (error) {
            console.error('Error deleting notification from Supabase:', error)
          }

          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== notificationId),
            unreadCount: state.notifications.find(n => n.id === notificationId)?.read ? state.unreadCount : Math.max(0, state.unreadCount - 1)
          }))
        } catch (error) {
          console.error('Error deleting notification:', error)
          // Fallback: update local state only
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== notificationId),
            unreadCount: state.notifications.find(n => n.id === notificationId)?.read ? state.unreadCount : Math.max(0, state.unreadCount - 1)
          }))
        }
      },

      clearAllNotifications: async () => {
        try {
          const { notifications } = get()
          const notificationIds = notifications.map(n => n.id)
          
          if (notificationIds.length > 0) {
            const { error } = await supabase
              .from('notifications')
              .update({ deleted: true })
              .in('id', notificationIds)

            if (error) {
              console.error('Error clearing notifications in Supabase:', error)
            }
          }

          set({
            notifications: [],
            unreadCount: 0,
            lastUpdated: new Date()
          })
        } catch (error) {
          console.error('Error clearing notifications:', error)
          // Fallback: update local state only
          set({
            notifications: [],
            unreadCount: 0,
            lastUpdated: new Date()
          })
        }
      },

      // ========== AUTO-NOTIFICATION HELPERS ==========

      addTimetableChangeNotification: (className, day, slotIndex, changeType, subject) => {
        const changeTypeText = {
          added: 'added',
          removed: 'cancelled',
          modified: 'modified'
        }[changeType]

        const subjectText = subject ? ` - ${subject}` : ''
        
        get().addNotification({
          userId: 'all',
          type: 'timetable_change',
          title: `📅 Timetable Update - ${className}`,
          message: `${changeTypeText === 'cancelled' ? 'Class cancelled' : `Class ${changeTypeText}`} on ${day}, period ${slotIndex + 1}${subjectText}`,
          priority: changeType === 'removed' ? 'high' : 'normal',
          actionUrl: '/timetable'
        })
      },

      addReplacementNotification: (className, originalTeacher, substituteTeacher, date, subject) => {
        get().addNotification({
          userId: 'all',
          type: 'replacement',
          title: `👨‍🏫 Replacement - ${className}`,
          message: `${originalTeacher} will be replaced by ${substituteTeacher}${subject ? ` for ${subject}` : ''} on ${new Date(date).toLocaleDateString()}`,
          priority: 'high',
          actionUrl: '/replacements'
        })
      },

      addMessageNotification: (senderName, subject, preview) => {
        get().addNotification({
          userId: 'all',
          type: 'message',
          title: `💬 New Message from ${senderName}`,
          message: `${subject}: ${preview}`,
          priority: 'normal',
          actionUrl: '/messages'
        })
      },

      addAnnouncementNotification: (title, content, audience) => {
        get().addNotification({
          userId: 'all',
          type: 'announcement',
          title: `📢 ${title}`,
          message: content,
          priority: audience === 'all' ? 'high' : 'normal',
          actionUrl: '/announcements'
        })
      },

      // ========== STATE MANAGEMENT ==========

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      subscribeToNotifications: (userId) => {
        if (!userId) return () => {}

        const schoolId = 'default'

        // Subscribe to Supabase realtime changes
        const channel = supabase
          .channel('notifications-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `school_id=eq.${schoolId}`
            },
            async (payload) => {
              // Fetch fresh data from Supabase
              const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('school_id', schoolId)
                .or(`user_id.eq.${userId},user_id.eq.all`)
                .eq('deleted', false)
                .order('timestamp', { ascending: false })

              if (error) {
                if (error.code === '42P01') {
                  console.warn('⚠️ notifications table does not exist. Please create it in Supabase.')
                } else {
                  console.error('Error fetching notifications from Supabase:', error)
                }
                return
              }

              if (data) {
                const notifications: NotificationWithId[] = data.map(item => ({
                  id: item.id,
                  userId: item.user_id,
                  type: item.type,
                  title: item.title,
                  message: item.message,
                  timestamp: item.timestamp,
                  read: item.read || false,
                  priority: item.priority || 'normal',
                  actionUrl: item.action_url
                }))

                const unreadCount = notifications.filter(n => !n.read).length

                set({
                  notifications,
                  unreadCount,
                  isLoading: false,
                  lastUpdated: new Date()
                })
              }
            }
          )
          .subscribe()

        // Initial fetch
        const fetchNotifications = async () => {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('school_id', schoolId)
            .or(`user_id.eq.${userId},user_id.eq.all`)
            .eq('deleted', false)
            .order('timestamp', { ascending: false })

          if (error) {
            if (error.code === '42P01') {
              console.warn('⚠️ notifications table does not exist. Please create it in Supabase.')
              set({ error: null, isLoading: false }) // Don't show error if table doesn't exist
              return
            }
            console.error('Error fetching notifications from Supabase:', error)
            set({ error: 'Failed to load notifications', isLoading: false })
            return
          }

          if (data) {
            const notifications: NotificationWithId[] = data.map(item => ({
              id: item.id,
              userId: item.user_id,
              type: item.type,
              title: item.title,
              message: item.message,
              timestamp: item.timestamp,
              read: item.read || false,
              priority: item.priority || 'normal',
              actionUrl: item.action_url
            }))

            const unreadCount = notifications.filter(n => !n.read).length

            set({
              notifications,
              unreadCount,
              isLoading: false,
              lastUpdated: new Date()
            })
          }
        }

        fetchNotifications()

        // Return unsubscribe function
        return () => {
          supabase.removeChannel(channel)
        }
      },

      refreshNotifications: () => {
        set({ lastUpdated: new Date() })
      },

      requestDesktopPermission: async () => {
        if (!('Notification' in window)) {
          set({ isDesktopEnabled: false })
          return false
        }

        const permission = await Notification.requestPermission()
        const isGranted = permission === 'granted'
        
        set({ isDesktopEnabled: isGranted })
        
        if (isGranted) {
          new window.Notification('Notifications enabled', {
            body: 'You will now receive real-time notifications',
            icon: '/favicon.ico'
          })
        }
        
        return isGranted
      },

      setDesktopEnabled: (enabled) => {
        set({ isDesktopEnabled: enabled })
      }
    }),
    {
      name: 'notifications-store',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50), // Keep last 50 notifications
        unreadCount: state.unreadCount,
        isDesktopEnabled: state.isDesktopEnabled
      })
    }
  )
)

// ========== HELPER FUNCTIONS ==========

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// ========== NOTIFICATION HOOKS ==========

export const useNotifications = () => useNotificationsStore((state) => state.notifications)
export const useUnreadCount = () => useNotificationsStore((state) => state.unreadCount)
export const useNotificationsLoading = () => useNotificationsStore((state) => state.isLoading)
export const useIsDesktopEnabled = () => useNotificationsStore((state) => state.isDesktopEnabled)

// ========== UTILITY FUNCTIONS FOR AUTO-NOTIFICATIONS ==========

/**
 * Send notification for timetable change
 * @param className - Name of the class
 * @param day - Day of the week
 * @param slotIndex - Time slot index (0-6)
 * @param changeType - Type of change (added, removed, modified)
 * @param subject - Optional subject name
 */
export const notifyTimetableChange = (
  className: string,
  day: string,
  slotIndex: number,
  changeType: 'added' | 'removed' | 'modified',
  subject?: string
) => {
  const { addTimetableChangeNotification } = useNotificationsStore.getState()
  addTimetableChangeNotification(className, day, slotIndex, changeType, subject)
}

/**
 * Send notification for teacher replacement
 * @param className - Name of the class
 * @param originalTeacher - Name of original teacher
 * @param substituteTeacher - Name of substitute teacher
 * @param date - Date of replacement
 * @param subject - Optional subject name
 */
export const notifyReplacement = (
  className: string,
  originalTeacher: string,
  substituteTeacher: string,
  date: string,
  subject?: string
) => {
  const { addReplacementNotification } = useNotificationsStore.getState()
  addReplacementNotification(className, originalTeacher, substituteTeacher, date, subject)
}

/**
 * Send notification for new message
 * @param senderName - Name of sender
 * @param subject - Message subject
 * @param preview - Message preview
 */
export const notifyNewMessage = (
  senderName: string,
  subject: string,
  preview: string
) => {
  const { addMessageNotification } = useNotificationsStore.getState()
  addMessageNotification(senderName, subject, preview)
}

/**
 * Send announcement notification
 * @param title - Announcement title
 * @param content - Announcement content
 * @param audience - Target audience
 */
export const notifyAnnouncement = (
  title: string,
  content: string,
  audience?: string
) => {
  const { addAnnouncementNotification } = useNotificationsStore.getState()
  addAnnouncementNotification(title, content, audience)
}



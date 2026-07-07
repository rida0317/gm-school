// src/components/NotificationBell.tsx - Enhanced notification bell with desktop notifications

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../store/AuthContext'
import { 
  useNotificationsStore, 
  useNotifications, 
  useUnreadCount,
  useIsDesktopEnabled,
  notifyTimetableChange,
  notifyReplacement,
  notifyNewMessage,
  notifyAnnouncement
} from '../store/notificationsStore'
import { formatDistanceToNow } from 'date-fns'
import './NotificationBell.css'

const NotificationBell: React.FC = () => {
  const { user } = useAuth()
  const notifications = useNotifications()
  const unreadCount = useUnreadCount()
  const isDesktopEnabled = useIsDesktopEnabled()
  const { 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    subscribeToNotifications,
    requestDesktopPermission,
    setDesktopEnabled
  } = useNotificationsStore()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Subscribe to notifications when user logs in
  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToNotifications(user.id)
      return unsubscribe
    }
  }, [user?.id, subscribeToNotifications])

  // Check desktop notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setDesktopEnabled(true)
    }
  }, [setDesktopEnabled])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    const granted = await requestDesktopPermission()
    if (!granted && 'Notification' in window && Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.')
    }
    setIsRequestingPermission(false)
  }

  const handleOpenDropdown = () => {
    setIsOpen(!isOpen)
    if (!isOpen && unreadCount > 0) {
      // Mark all as read when opening
      markAllAsRead()
    }
  }

  const handleNotificationClick = (notificationId: string, actionUrl?: string) => {
    markAsRead(notificationId)
    if (actionUrl) {
      window.location.href = actionUrl
    }
    setIsOpen(false)
  }

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    deleteNotification(notificationId)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return '💬'
      case 'announcement': return '📢'
      case 'timetable_change': return '📅'
      case 'replacement': return '👨‍🏫'
      case 'system': return '⚙️'
      default: return '🔔'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message': return 'notification--message'
      case 'announcement': return 'notification--announcement'
      case 'timetable_change': return 'notification--timetable'
      case 'replacement': return 'notification--replacement'
      case 'system': return 'notification--system'
      default: return ''
    }
  }

  // Demo function - can be used to test notifications
  const handleSendTestNotification = () => {
    const testTypes = ['message', 'timetable_change', 'replacement', 'announcement'] as const
    const randomType = testTypes[Math.floor(Math.random() * testTypes.length)]
    
    switch (randomType) {
      case 'message':
        notifyNewMessage('Admin', 'Meeting Tomorrow', 'Don\'t forget about the staff meeting at 10 AM')
        break
      case 'timetable_change':
        notifyTimetableChange('2BAC SH', 'Monday', 2, 'added', 'Mathematics')
        break
      case 'replacement':
        notifyReplacement('1BAC PC', 'Mr. Ahmed', 'Mrs. Fatima', new Date().toISOString(), 'Physics')
        break
      case 'announcement':
        notifyAnnouncement('School Closure', 'School will be closed next Friday for a national holiday', 'all')
        break
    }
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell"
        onClick={handleOpenDropdown}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        title={isDesktopEnabled ? 'Desktop notifications enabled' : 'Click to enable desktop notifications'}
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            <div className="header-actions">
              {unreadCount > 0 && (
                <button className="mark-all-read" onClick={markAllAsRead}>
                  Mark all read
                </button>
              )}
              {!isDesktopEnabled && (
                <button
                  className="enable-notifications"
                  onClick={handleRequestPermission}
                  disabled={isRequestingPermission}
                  title="Enable desktop notifications"
                >
                  {isRequestingPermission ? 'Enabling...' : '🖥️ Enable Desktop'}
                </button>
              )}
              {isDesktopEnabled && (
                <button
                  className="enable-notifications"
                  onClick={handleSendTestNotification}
                  title="Send test notification"
                >
                  🧪 Test
                </button>
              )}
            </div>
          </div>

          <div className="notification-dropdown-content">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <span className="empty-icon">🔕</span>
                <p>No notifications yet</p>
                <p className="empty-hint">You'll be notified here when there are updates</p>
                {!isDesktopEnabled && (
                  <button 
                    className="enable-notifications-btn"
                    onClick={handleRequestPermission}
                    disabled={isRequestingPermission}
                  >
                    {isRequestingPermission ? 'Enabling...' : 'Enable Desktop Notifications'}
                  </button>
                )}
              </div>
            ) : (
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''} ${getNotificationColor(notification.type)}`}
                    onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-content">
                      <div className="notification-header">
                        <span className="notification-title">{notification.title}</span>
                        {notification.priority === 'urgent' && (
                          <span className="urgent-badge">🔴 URGENT</span>
                        )}
                        {notification.priority === 'high' && (
                          <span className="high-badge">🟠 HIGH</span>
                        )}
                      </div>
                      <p className="notification-message">{notification.message}</p>
                      <div className="notification-footer">
                        <span className="notification-time">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </span>
                        <button
                          className="delete-notification"
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          aria-label="Delete notification"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <a href="/messages">View all notifications</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell


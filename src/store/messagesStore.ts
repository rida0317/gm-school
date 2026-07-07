// src/store/messagesStore.ts - Zustand store for internal messaging system
// Supabase Version

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabaseClient'
import type { Message, MessageAttachment, User } from '../types'
import { useAuth } from './AuthContext'


export interface MessageWithId extends Message {
  id: string
}

export interface MessageFilter {
  type?: 'all' | 'received' | 'sent' | 'unread'
  priority?: 'all' | 'normal' | 'urgent' | 'high'
  search?: string
}

interface MessagesState {
  messages: MessageWithId[]
  conversations: Map<string, MessageWithId[]> // Messages grouped by conversation
  selectedConversation: string | null
  unreadCount: number
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface MessagesActions {
  // Message actions
  sendMessage: (recipientId: string, subject: string, content: string, priority?: 'normal' | 'urgent' | 'high') => Promise<void>
  markAsRead: (messageId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  replyToMessage: (messageId: string, content: string) => Promise<void>
  
  // Filter actions
  setFilter: (filter: MessageFilter) => void
  setSearch: (search: string) => void
  
  // Conversation actions
  selectConversation: (userId: string) => void
  getConversationMessages: (userId: string) => MessageWithId[]
  
  // State actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  subscribeToMessages: (userId: string) => () => void
  refreshMessages: () => void
}

export type MessagesStore = MessagesState & MessagesActions

const initialState: MessagesState = {
  messages: [],
  conversations: new Map(),
  selectedConversation: null,
  unreadCount: 0,
  isLoading: false,
  error: null,
  lastUpdated: null
}

export const useMessagesStore = create<MessagesStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== MESSAGE ACTIONS ==========

      sendMessage: async (recipientId, subject, content, priority = 'normal') => {
        const state = get()
        const currentUser = useAuth.getState().user
        const schoolId = 'default'

        if (!currentUser?.id) {
          set({ error: 'User not authenticated' })
          return
        }

        const newMessage: MessageWithId = {
          id: generateId(),
          senderId: currentUser.id,
          recipientId,
          recipientType: 'user',
          subject,
          content,
          timestamp: new Date().toISOString(),
          read: false,
          priority
        }

        // Save to Supabase
        try {
          const { error } = await supabase
            .from('messages')
            .insert({
              id: newMessage.id,
              school_id: schoolId,
              sender_id: currentUser.id,
              recipient_id: recipientId,
              recipient_type: 'user',
              subject,
              content,
              timestamp: new Date().toISOString(),
              read: false,
              priority,
              deleted: false
            })

          if (error) {
            console.error('Error sending message to Supabase:', error)
          }
        } catch (error) {
          console.error('Error sending message:', error)
        }

        // Update local state
        set((state) => ({
          messages: [newMessage, ...state.messages],
          lastUpdated: new Date()
        }))

        // Add to conversations
        const conversations = new Map(state.conversations)
        const conversationMessages = conversations.get(recipientId) || []
        conversations.set(recipientId, [newMessage, ...conversationMessages])
        set({ conversations })
      },

      markAsRead: async (messageId) => {
        try {
          const { error } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('id', messageId)

          if (error) {
            console.error('Error marking message as read in Supabase:', error)
          }

          set((state) => ({
            messages: state.messages.map(m =>
              m.id === messageId ? { ...m, read: true } : m
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }))
        } catch (error) {
          console.error('Error marking message as read:', error)
          // Fallback to local update
          set((state) => ({
            messages: state.messages.map(m =>
              m.id === messageId ? { ...m, read: true } : m
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }))
        }
      },

      markAllAsRead: async () => {
        try {
          const { messages } = get()
          const currentUser = useAuth.getState().user
          if (!currentUser?.id) return

          const unreadMessages = messages.filter(m => !m.read && m.recipientId === currentUser.id)

          const messageIds = unreadMessages.map(m => m.id)
          
          if (messageIds.length > 0) {
            const { error } = await supabase
              .from('messages')
              .update({ read: true })
              .in('id', messageIds)

            if (error) {
              console.error('Error marking all messages as read in Supabase:', error)
            }
          }

          set((state) => ({
            messages: state.messages.map(m =>
              m.recipientId === currentUser.id ? { ...m, read: true } : m
            ),
            unreadCount: 0
          }))
        } catch (error) {
          console.error('Error marking all messages as read:', error)
          set({ unreadCount: 0 })
        }
      },

      deleteMessage: async (messageId) => {
        try {
          const { error } = await supabase
            .from('messages')
            .update({ deleted: true })
            .eq('id', messageId)

          if (error) {
            console.error('Error deleting message from Supabase:', error)
          }

          set((state) => ({
            messages: state.messages.filter(m => m.id !== messageId),
            unreadCount: state.messages.find(m => m.id === messageId)?.read ? state.unreadCount : Math.max(0, state.unreadCount - 1)
          }))
        } catch (error) {
          console.error('Error deleting message:', error)
          set((state) => ({
            messages: state.messages.filter(m => m.id !== messageId)
          }))
        }
      },

      replyToMessage: async (originalMessageId, content) => {
        const { messages } = get()
        const originalMessage = messages.find(m => m.id === originalMessageId)
        
        if (!originalMessage) {
          set({ error: 'Message not found' })
          return
        }

        // Reply to the sender of the original message
        await get().sendMessage(
          originalMessage.senderId,
          `Re: ${originalMessage.subject}`,
          content,
          originalMessage.priority
        )
      },

      // ========== FILTER ACTIONS ==========

      setFilter: (filter) => {
        const currentUser = useAuth.getState().user
        if (!currentUser?.id) return

        let filteredMessages = get().messages

        // Apply type filter
        if (filter.type === 'received') {
          filteredMessages = filteredMessages.filter(m => m.recipientId === currentUser.id)
        } else if (filter.type === 'sent') {
          filteredMessages = filteredMessages.filter(m => m.senderId === currentUser.id)
        } else if (filter.type === 'unread') {
          filteredMessages = filteredMessages.filter(m => !m.read && m.recipientId === currentUser.id)
        }

        // Apply priority filter
        if (filter.priority && filter.priority !== 'all') {
          filteredMessages = filteredMessages.filter(m => m.priority === filter.priority)
        }

        // Apply search filter
        if (filter.search) {
          const searchLower = filter.search.toLowerCase()
          filteredMessages = filteredMessages.filter(m =>
            m.subject.toLowerCase().includes(searchLower) ||
            m.content.toLowerCase().includes(searchLower)
          )
        }

        set({ messages: filteredMessages })
      },

      setSearch: (search) => {
        if (!search) {
          // Reset to all messages
          const currentUser = useAuth.getState().user
          if (currentUser?.id) {
            set((state) => ({
              messages: state.messages.filter(m =>
                m.recipientId === currentUser.id || m.senderId === currentUser.id
              )
            }))
          }
          return
        }

        const searchLower = search.toLowerCase()
        set((state) => ({
          messages: state.messages.filter(m =>
            m.subject.toLowerCase().includes(searchLower) ||
            m.content.toLowerCase().includes(searchLower)
          )
        }))
      },

      // ========== CONVERSATION ACTIONS ==========

      selectConversation: (userId) => {
        set({ selectedConversation: userId })

        // Mark all messages in this conversation as read
        const { messages } = get()
        const currentUser = useAuth.getState().user

        messages
          .filter(m => (m.senderId === userId || m.recipientId === userId) && !m.read && m.recipientId === currentUser?.id)
          .forEach(m => {
            get().markAsRead(m.id)
          })
      },

      getConversationMessages: (userId) => {
        const { messages } = get()
        return messages
          .filter(m => m.senderId === userId || m.recipientId === userId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      },

      // ========== STATE ACTIONS ==========

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      subscribeToMessages: (userId) => {
        if (!userId) return () => {}

        const schoolId = 'default'

        // Subscribe to Supabase realtime changes
        const channel = supabase
          .channel('messages-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `school_id=eq.${schoolId}`
            },
            async (payload) => {
              // Fetch fresh data from Supabase
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('school_id', schoolId)
                .or(`sender_id.eq.${userId},recipient_id.eq.${userId},recipient_id.eq.all`)
                .eq('deleted', false)
                .order('timestamp', { ascending: false })

              if (error) {
                console.error('Error fetching messages from Supabase:', error)
                return
              }

              if (data) {
                const messages: MessageWithId[] = data.map(item => ({
                  id: item.id,
                  senderId: item.sender_id,
                  recipientId: item.recipient_id,
                  recipientType: item.recipient_type,
                  subject: item.subject,
                  content: item.content,
                  timestamp: item.timestamp,
                  read: item.read || false,
                  priority: item.priority || 'normal'
                }))

                const conversations = new Map<string, MessageWithId[]>()
                let unreadCount = 0

                messages.forEach(message => {
                  // Group by conversation
                  const otherUserId = message.senderId === userId ? message.recipientId : message.senderId
                  const conversationMessages = conversations.get(otherUserId) || []
                  conversationMessages.push(message)
                  conversations.set(otherUserId, conversationMessages)

                  // Count unread
                  if (!message.read && message.recipientId === userId) {
                    unreadCount++
                  }
                })

                set({
                  messages,
                  conversations,
                  unreadCount,
                  isLoading: false,
                  lastUpdated: new Date()
                })
              }
            }
          )
          .subscribe()

        // Initial fetch
        const fetchMessages = async () => {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('school_id', schoolId)
            .or(`sender_id.eq.${userId},recipient_id.eq.${userId},recipient_id.eq.all`)
            .eq('deleted', false)
            .order('timestamp', { ascending: false })

          if (error) {
            console.error('Error fetching messages from Supabase:', error)
            set({ error: 'Failed to load messages', isLoading: false })
            return
          }

          if (data) {
            const messages: MessageWithId[] = data.map(item => ({
              id: item.id,
              senderId: item.sender_id,
              recipientId: item.recipient_id,
              recipientType: item.recipient_type,
              subject: item.subject,
              content: item.content,
              timestamp: item.timestamp,
              read: item.read || false,
              priority: item.priority || 'normal'
            }))

            const conversations = new Map<string, MessageWithId[]>()
            let unreadCount = 0

            messages.forEach(message => {
              const otherUserId = message.senderId === userId ? message.recipientId : message.senderId
              const conversationMessages = conversations.get(otherUserId) || []
              conversationMessages.push(message)
              conversations.set(otherUserId, conversationMessages)

              if (!message.read && message.recipientId === userId) {
                unreadCount++
              }
            })

            set({
              messages,
              conversations,
              unreadCount,
              isLoading: false,
              lastUpdated: new Date()
            })
          }
        }

        fetchMessages()

        // Return unsubscribe function
        return () => {
          supabase.removeChannel(channel)
        }
      },

      refreshMessages: () => {
        set({ lastUpdated: new Date() })
      }
    }),
    {
      name: 'messages-store',
      partialize: (state) => ({
        messages: state.messages.slice(0, 100), // Keep last 100 messages
        unreadCount: state.unreadCount
      })
    }
  )
)

// ========== HELPER FUNCTIONS ==========

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// ========== SELECTOR HOOKS ==========

export const useMessages = () => useMessagesStore((state) => state.messages)
export const useUnreadMessagesCount = () => useMessagesStore((state) => state.unreadCount)
export const useSelectedConversation = () => useMessagesStore((state) => state.selectedConversation)
export const useMessagesLoading = () => useMessagesStore((state) => state.isLoading)

// ========== UTILITY FUNCTIONS ==========

/**
 * Send a message
 */
export const sendMessage = async (
  recipientId: string,
  subject: string,
  content: string,
  priority?: 'normal' | 'urgent' | 'high'
) => {
  const { sendMessage: send } = useMessagesStore.getState()
  return send(recipientId, subject, content, priority)
}

/**
 * Get messages for a conversation
 */
export const getConversationMessages = (userId: string): MessageWithId[] => {
  const { getConversationMessages: get } = useMessagesStore.getState()
  return get(userId)
}



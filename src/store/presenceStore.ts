import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from './authStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface OnlineUser {
  id: string
  username: string
  avatar_url: string | null
  status: string
}

interface PresenceState {
  onlineUsers: OnlineUser[]
  status: 'available' | 'busy' | 'offline'
  channel: RealtimeChannel | null
  heartbeatInterval: ReturnType<typeof setInterval> | null
  
  // Actions
  initializePresence: () => Promise<void>
  cleanupPresence: () => Promise<void>
  setStatus: (status: 'available' | 'busy' | 'offline') => Promise<void>
  isUserOnline: (userId: string) => boolean
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: [],
  status: 'available',
  channel: null,
  heartbeatInterval: null,

  initializePresence: async () => {
    const { user, profile } = useAuthStore.getState()
    if (!user || !profile) return

    // Clean up existing channel
    const existingChannel = get().channel
    if (existingChannel) {
      await supabase.removeChannel(existingChannel)
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: OnlineUser[] = []
        
        Object.keys(state).forEach(userId => {
          const presences = state[userId]
          if (presences && presences.length > 0 && userId !== user.id) {
            const presence = presences[0] as any
            users.push({
              id: userId,
              username: presence.username || 'Unknown',
              avatar_url: presence.avatar_url || null,
              status: presence.status || 'available'
            })
          }
        })
        
        set({ onlineUsers: users })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            status: profile.status || 'available'
          })

          // Update database
          await supabase
            .from('profiles')
            .update({
              status: 'available',
              is_online: true,
              last_seen: new Date().toISOString()
            } as any)
            .eq('id', user.id)
        }
      })

    // Start heartbeat
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() } as any)
          .eq('id', user.id)
      }
    }, 30000)

    set({ channel, heartbeatInterval: interval, status: 'available' })
  },

  cleanupPresence: async () => {
    const { channel, heartbeatInterval } = get()
    const { user } = useAuthStore.getState()

    if (channel) {
      await channel.untrack()
      await supabase.removeChannel(channel)
    }

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }

    if (user) {
      await supabase
        .from('profiles')
        .update({
          status: 'offline',
          is_online: false,
          last_seen: new Date().toISOString()
        } as any)
        .eq('id', user.id)
    }

    set({ channel: null, heartbeatInterval: null, onlineUsers: [] })
  },

  setStatus: async (status) => {
    const { user } = useAuthStore.getState()
    const { channel } = get()
    
    if (user) {
      await supabase
        .from('profiles')
        .update({ status } as any)
        .eq('id', user.id)

      if (channel) {
        const { profile } = useAuthStore.getState()
        await channel.track({
          user_id: user.id,
          username: profile?.username || '',
          avatar_url: profile?.avatar_url || null,
          status
        })
      }
    }
    
    set({ status })
  },

  isUserOnline: (userId) => {
    return get().onlineUsers.some(u => u.id === userId)
  }
}))

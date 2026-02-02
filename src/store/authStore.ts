import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'
import type { User, AuthError } from '@supabase/supabase-js'

interface Profile {
  id: string
  username: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  status: string
  is_online: boolean
  last_seen: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

interface AuthResult {
  error: AuthError | Error | null
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  fetchProfile: (userId: string) => Promise<Profile | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    // Retry logic for AbortError
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (error) {
          // Check if it's an AbortError
          if (error.message?.includes('AbortError') || error.message?.includes('abort')) {
            attempts++
            if (attempts < maxAttempts) {
              console.log(`Profile fetch aborted, retrying (${attempts}/${maxAttempts})...`)
              await new Promise(resolve => setTimeout(resolve, 200 * attempts))
              continue
            }
          }
          console.error('Error fetching profile:', error)
          return null
        }
        
        return profile as Profile
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
          attempts++
          if (attempts < maxAttempts) {
            console.log(`Profile fetch exception, retrying (${attempts}/${maxAttempts})...`)
            await new Promise(resolve => setTimeout(resolve, 200 * attempts))
            continue
          }
        }
        console.error('Exception fetching profile:', err)
        return null
      }
    }
    
    return null
  },

  signUp: async (email, password, username, fullName) => {
    try {
      // Sign up with metadata
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            username,
            full_name: fullName || ''
          }
        }
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        // Wait for trigger to create profile
        let profile: Profile | null = null
        let attempts = 0
        
        while (attempts < 10 && !profile) {
          await new Promise(resolve => setTimeout(resolve, 500))
          profile = await get().fetchProfile(data.user.id)
          attempts++
        }

        if (profile) {
          // Update full_name if provided
          if (fullName) {
            await supabase
              .from('profiles')
              .update({ full_name: fullName } as any)
              .eq('id', data.user.id)
            profile.full_name = fullName
          }
          
          set({ user: data.user, profile })
        }
      }

      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        // Update online status
        await supabase
          .from('profiles')
          .update({
            status: 'available',
            is_online: true,
            last_seen: new Date().toISOString()
          } as any)
          .eq('id', data.user.id)

        // Get profile
        const profile = await get().fetchProfile(data.user.id)
        set({ user: data.user, profile })
      }

      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  },

  signOut: async () => {
    const { user } = get()
    
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

    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  initialize: async () => {
    if (get().initialized) return
    
    // Mark as initialized immediately to prevent double calls
    set({ initialized: true })
    
    try {
      // Get current session without throwing on abort
      let session = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data.session
      } catch (sessionError: any) {
        // Ignore AbortError - this is a known Supabase issue
        if (sessionError?.name === 'AbortError' || sessionError?.message?.includes('abort')) {
          console.log('Session fetch aborted, retrying...')
          // Retry once
          try {
            const { data } = await supabase.auth.getSession()
            session = data.session
          } catch {
            // Ignore second failure
          }
        } else {
          console.error('Session error:', sessionError)
        }
      }
      
      if (session?.user) {
        console.log('Session found for user:', session.user.id)
        const profile = await get().fetchProfile(session.user.id)
        console.log('Profile loaded:', profile)
        
        if (profile) {
          // Update online status
          try {
            await supabase
              .from('profiles')
              .update({
                status: 'available',
                is_online: true,
                last_seen: new Date().toISOString()
              } as any)
              .eq('id', session.user.id)
          } catch {
            // Ignore update errors
          }
          
          set({ user: session.user, profile, loading: false })
        } else {
          console.error('Profile not found for user:', session.user.id)
          // Still set user even without profile
          set({ user: session.user, profile: null, loading: false })
        }
      } else {
        set({ loading: false })
      }

      // Listen for auth changes with debouncing to prevent multiple triggers
      let authDebounceTimer: NodeJS.Timeout | null = null
      let lastEvent: string | null = null
      
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          // Ignore INITIAL_SESSION as we already handled it above
          if (event === 'INITIAL_SESSION') return
          
          // Debounce rapid auth changes to prevent loops
          if (lastEvent === event) return
          lastEvent = event
          
          if (authDebounceTimer) clearTimeout(authDebounceTimer)
          
          authDebounceTimer = setTimeout(async () => {
            if (event === 'SIGNED_IN' && session?.user) {
              // Only update if we don't already have this user
              const currentUser = get().user
              if (currentUser?.id === session.user.id) return
              
              const profile = await get().fetchProfile(session.user.id)
              set({ user: session.user, profile, loading: false })
            } else if (event === 'SIGNED_OUT') {
              // Only sign out if we have a user
              if (!get().user) return
              set({ user: null, profile: null, loading: false })
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
              // Just update the user object, keep profile
              set({ user: session.user })
            }
          }, 100)
        })
        
        // Store subscription for cleanup if needed
        if (typeof window !== 'undefined') {
          (window as any).__authSubscription = subscription
        }
      } catch (subscriptionError: any) {
        // Ignore AbortError for subscription setup
        if (subscriptionError?.name !== 'AbortError') {
          console.error('Auth subscription error:', subscriptionError)
        }
      }
    } catch (error: any) {
      // Ignore AbortError globally
      if (error?.name !== 'AbortError') {
        console.error('Auth initialization error:', error)
      }
      set({ loading: false })
    }
  }
}))

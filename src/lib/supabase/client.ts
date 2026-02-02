import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

// Global singleton - must be outside any function to persist across HMR
let globalSupabase: SupabaseClient | null = null

// Check if we're in browser
const isBrowser = typeof window !== 'undefined'

// Create the singleton only once
if (isBrowser && !globalSupabase) {
  globalSupabase = createClientComponentClient({
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Disable navigator lock to prevent AbortError
        lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
          // Just run the function without locking
          return await fn()
        }
      }
    }
  } as any)
}

export function getSupabase(): SupabaseClient {
  if (isBrowser) {
    if (!globalSupabase) {
      globalSupabase = createClientComponentClient({
        options: {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
              return await fn()
            }
          }
        }
      } as any)
    }
    return globalSupabase
  }
  // Server-side: create new instance
  return createClientComponentClient()
}

// Export the singleton directly (safe because we check isBrowser)
export const supabase = isBrowser ? getSupabase() : (null as unknown as SupabaseClient)
export const createClient = getSupabase

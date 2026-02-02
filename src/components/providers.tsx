'use client'

import { ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

function AuthInitializer({ children }: { children: ReactNode }) {
  const { initialize, initialized } = useAuthStore()

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialize, initialized])

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthInitializer>
      {children}
    </AuthInitializer>
  )
}

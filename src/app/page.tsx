'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import AuthForm from '@/components/auth/AuthForm'

export default function HomePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !loading && user && profile) {
      router.push('/dashboard')
    }
  }, [user, profile, loading, router, mounted])

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  if (user && profile) {
    return null // Will redirect
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3">
            🎥 Mimi Insta
          </h1>
          <p className="text-white/80 text-lg">
            Professional Social Calling Platform
          </p>
        </div>
        
        <AuthForm />
      </div>
    </main>
  )
}

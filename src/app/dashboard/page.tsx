'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import UserSearch from '@/components/dashboard/UserSearch'
import OnlineUsers from '@/components/dashboard/OnlineUsers'
import CallHistory from '@/components/dashboard/CallHistory'
import CallOverlay from '@/components/call/CallOverlay'

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuthStore()
  const { initializePresence } = usePresenceStore()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && profile) {
      initializePresence()
    }
  }, [user, profile, initializePresence])

  // Show loading for max 5 seconds, then show error
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center p-8">
          <h2 className="text-xl font-bold mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">Your profile could not be loaded. Please try logging out and back in.</p>
          <button 
            onClick={() => useAuthStore.getState().signOut().then(() => router.push('/'))}
            className="btn btn-primary"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="card mb-6">
          <DashboardHeader />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">Search Users</h2>
              <UserSearch />
            </div>

            <div className="card">
              <h2 className="text-2xl font-bold mb-4">Call History</h2>
              <CallHistory />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h2 className="text-2xl font-bold mb-4">Online Now</h2>
              <OnlineUsers />
            </div>
          </div>
        </div>
      </div>

      <CallOverlay />
    </main>
  )
}

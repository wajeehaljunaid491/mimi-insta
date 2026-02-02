'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import UserSearch from '@/components/dashboard/UserSearch'
import OnlineUsers from '@/components/dashboard/OnlineUsers'
import CallHistory from '@/components/dashboard/CallHistory'
import FollowedUsers from '@/components/dashboard/FollowedUsers'
import CallOverlay from '@/components/call/CallOverlay'
import Chat from '@/components/chat/Chat'
import Settings from '@/components/settings/Settings'
import Stories from '@/components/stories/Stories'

type TabType = 'people' | 'messages' | 'history' | 'search' | 'settings'

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuthStore()
  const { initializePresence } = usePresenceStore()
  const [activeTab, setActiveTab] = useState<TabType>('people')
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [openChatUserId, setOpenChatUserId] = useState<string | null>(null)

  // Handle starting a chat with a specific user
  const handleStartChat = (userId: string) => {
    setOpenChatUserId(userId)
    setActiveTab('messages')
  }

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950 p-4">
        <div className="bg-slate-800/80 backdrop-blur-lg rounded-2xl text-center p-8 max-w-sm w-full border border-slate-700/50">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-white">Profile Not Found</h2>
          <p className="text-gray-400 mb-6 text-sm">Your profile could not be loaded. Please try signing out and back in.</p>
          <button 
            onClick={() => useAuthStore.getState().signOut().then(() => router.push('/'))}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-lg mx-auto">
          <DashboardHeader />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Stories Section - Shows on people tab */}
        {activeTab === 'people' && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl mb-4 overflow-hidden">
            <Stories />
          </div>
        )}

        {/* Tab Content */}
        <div className="py-4">
          {activeTab === 'people' && (
            <div className="space-y-4">
              {/* Online Users Section */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                  <h2 className="text-lg font-semibold text-white">Online Now</h2>
                </div>
                <OnlineUsers onStartChat={handleStartChat} />
              </div>

              {/* Following Section */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-white">People You Follow</h2>
                </div>
                <FollowedUsers onStartChat={handleStartChat} />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-white">Call History</h2>
              </div>
              <CallHistory />
            </div>
          )}

          {activeTab === 'search' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-white">Find Users</h2>
              </div>
              <UserSearch />
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
              <Chat 
                onUnreadCountChange={setUnreadMessages} 
                openUserId={openChatUserId}
                onOpenUserIdHandled={() => setOpenChatUserId(null)}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/30 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
              <Settings />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/50 safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around items-center py-2">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              activeTab === 'people' 
                ? 'text-cyan-400 bg-cyan-500/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">People</span>
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all relative ${
              activeTab === 'messages' 
                ? 'text-cyan-400 bg-cyan-500/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </div>
            <span className="text-xs mt-1 font-medium">Messages</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              activeTab === 'history' 
                ? 'text-cyan-400 bg-cyan-500/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">History</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              activeTab === 'search' 
                ? 'text-cyan-400 bg-cyan-500/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Search</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              activeTab === 'settings' 
                ? 'text-cyan-400 bg-cyan-500/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Settings</span>
          </button>
        </div>
      </nav>

      <CallOverlay />
    </main>
  )
}

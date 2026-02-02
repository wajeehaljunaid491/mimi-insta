'use client'

import { useEffect, useState } from 'react'
import { usePresenceStore } from '@/store/presenceStore'
import { useAuthStore } from '@/store/authStore'
import { initiateCall } from '@/lib/calls'

export default function OnlineUsers() {
  const { onlineUsers } = usePresenceStore()
  const { user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [callingUser, setCallingUser] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const INITIAL_DISPLAY = 5

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
      </div>
    )
  }

  const handleCall = async (userId: string, callType: 'voice' | 'video') => {
    setCallingUser(userId)
    const result = await initiateCall(userId, callType)
    if (!result) {
      alert('Failed to initiate call. Please try again.')
      setCallingUser(null)
    }
  }

  // Filter out current user
  const filteredUsers = onlineUsers.filter(u => u.id !== user?.id)
  const displayedUsers = showAll ? filteredUsers : filteredUsers.slice(0, INITIAL_DISPLAY)
  const hasMore = filteredUsers.length > INITIAL_DISPLAY

  if (filteredUsers.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
        </div>
        <p className="text-gray-400 text-sm">No one's online right now</p>
        <p className="text-gray-500 text-xs mt-1">Check back later</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {displayedUsers.map((onlineUser) => (
        <div
          key={onlineUser.id}
          className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl"
        >
          {/* Avatar with pulse */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-semibold overflow-hidden">
              {onlineUser.avatar_url ? (
                <img src={onlineUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                onlineUser.username?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800 animate-pulse"></div>
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{onlineUser.username}</p>
            <p className="text-xs text-green-400">Online now</p>
          </div>

          {/* Call buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCall(onlineUser.id, 'voice')}
              disabled={callingUser === onlineUser.id}
              className="p-2.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
              title="Voice call"
            >
              {callingUser === onlineUser.id ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => handleCall(onlineUser.id, 'video')}
              disabled={callingUser === onlineUser.id}
              className="p-2.5 rounded-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
              title="Video call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* See More / See Less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-green-400 hover:text-green-300 font-medium transition-colors flex items-center justify-center gap-2"
        >
          {showAll ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Show Less
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              See More ({filteredUsers.length - INITIAL_DISPLAY} more)
            </>
          )}
        </button>
      )}

      <p className="text-center text-green-500/50 text-xs pt-1">
        {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'} online
      </p>
    </div>
  )
}

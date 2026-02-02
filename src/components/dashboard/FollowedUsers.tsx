'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'
import { getFollowing, unfollowUser, blockUser } from '@/lib/follows'
import { initiateCall } from '@/lib/calls'

interface FollowedUser {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  is_online: boolean
  status: string
}

interface FollowedUsersProps {
  onStartChat?: (userId: string) => void
}

export default function FollowedUsers({ onStartChat }: FollowedUsersProps) {
  const { user } = useAuthStore()
  const { onlineUsers } = usePresenceStore()
  const [following, setFollowing] = useState<FollowedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)
  const [callingId, setCallingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const INITIAL_DISPLAY = 5

  useEffect(() => {
    loadFollowing()
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadFollowing = async () => {
    if (!user) return
    setLoading(true)
    const data = await getFollowing(user.id)
    setFollowing(data)
    setLoading(false)
  }

  const handleUnfollow = async (userId: string) => {
    setOpenMenuId(null)
    setUnfollowingId(userId)
    const success = await unfollowUser(userId)
    if (success) {
      setFollowing(prev => prev.filter(u => u.id !== userId))
    }
    setUnfollowingId(null)
  }

  const handleBlock = async (userId: string) => {
    if (!confirm('Block this user? They won\'t be able to see your profile or contact you.')) return
    setOpenMenuId(null)
    const success = await blockUser(userId)
    if (success) {
      setFollowing(prev => prev.filter(u => u.id !== userId))
    }
  }

  const handleCall = async (userId: string, callType: 'voice' | 'video') => {
    setCallingId(userId)
    await initiateCall(userId, callType)
    setCallingId(null)
  }

  // Merge online status from presence store
  const getUsersWithOnlineStatus = () => {
    return following.map(user => ({
      ...user,
      is_online: onlineUsers.some(ou => ou.id === user.id)
    })).sort((a, b) => {
      // Online users first
      if (a.is_online && !b.is_online) return -1
      if (!a.is_online && b.is_online) return 1
      return 0
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent"></div>
      </div>
    )
  }

  const usersWithStatus = getUsersWithOnlineStatus()
  const displayedUsers = showAll ? usersWithStatus : usersWithStatus.slice(0, INITIAL_DISPLAY)
  const hasMore = usersWithStatus.length > INITIAL_DISPLAY

  if (following.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">You're not following anyone yet</p>
        <p className="text-gray-500 text-xs mt-1">Search for users to follow them</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {displayedUsers.map(person => (
        <div
          key={person.id}
          className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors group"
        >
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
              {person.avatar_url ? (
                <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                person.username?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            {/* Online indicator */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-800 ${
              person.is_online ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-gray-500'
            }`}></div>
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{person.username}</p>
            <p className={`text-xs ${person.is_online ? 'text-emerald-400' : 'text-gray-500'}`}>
              {person.is_online ? 'Online' : 'Offline'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Chat button */}
            <button
              onClick={() => onStartChat?.(person.id)}
              className="p-2.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
              title="Send message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>

            {/* Voice call */}
            <button
              onClick={() => handleCall(person.id, 'voice')}
              disabled={callingId === person.id || !person.is_online}
              className={`p-2.5 rounded-full transition-all ${
                person.is_online 
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={person.is_online ? 'Voice call' : 'User is offline'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>

            {/* Video call */}
            <button
              onClick={() => handleCall(person.id, 'video')}
              disabled={callingId === person.id || !person.is_online}
              className={`p-2.5 rounded-full transition-all ${
                person.is_online 
                  ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={person.is_online ? 'Video call' : 'User is offline'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            {/* More Options Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === person.id ? null : person.id)
                }}
                className="p-2.5 rounded-full bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-all"
                title="More options"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {openMenuId === person.id && (
                <div 
                  className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleUnfollow(person.id)}
                    disabled={unfollowingId === person.id}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                  >
                    {unfollowingId === person.id ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                      </svg>
                    )}
                    Unfollow
                  </button>
                  <button
                    onClick={() => handleBlock(person.id)}
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-3 transition-colors border-t border-slate-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Block
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* See More / See Less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors flex items-center justify-center gap-2"
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
              See More ({usersWithStatus.length - INITIAL_DISPLAY} more)
            </>
          )}
        </button>
      )}

      <p className="text-center text-gray-500 text-xs pt-2">
        Following {following.length} {following.length === 1 ? 'person' : 'people'}
      </p>
    </div>
  )
}

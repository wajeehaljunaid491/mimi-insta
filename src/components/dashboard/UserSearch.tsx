'use client'

import { useState, useEffect } from 'react'
import { searchUsers } from '@/lib/search'
import { followUser, unfollowUser } from '@/lib/follows'
import { initiateCall } from '@/lib/calls'
import { useAuthStore } from '@/store/authStore'

interface SearchResult {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  status: string
  is_online: boolean
  is_verified: boolean
  is_following: boolean
  is_follower: boolean
  is_blocked: boolean
}

export default function UserSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const { user } = useAuthStore()

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true)
        const users = await searchUsers(query) as SearchResult[]
        setResults(users)
        setFollowingIds(new Set(users.filter((u: SearchResult) => u.is_following).map((u: SearchResult) => u.id)))
        setLoading(false)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleFollow = async (userId: string) => {
    const success = await followUser(userId)
    if (success) {
      setFollowingIds(prev => new Set([...prev, userId]))
      setResults(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: true } : u
      ))
    }
  }

  const handleUnfollow = async (userId: string) => {
    const success = await unfollowUser(userId)
    if (success) {
      setFollowingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
      setResults(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: false } : u
      ))
    }
  }

  const handleCall = async (userId: string, callType: 'voice' | 'video') => {
    await initiateCall(userId, callType)
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by username, name, or bio..."
          className="input"
        />
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      )}

      {!loading && results.length === 0 && query.trim().length >= 2 && (
        <p className="text-gray-500 text-center py-8">No users found</p>
      )}

      <div className="space-y-3">
        {results.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                {user.is_online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{user.username}</span>
                  {user.is_verified && <span className="text-blue-500">✓</span>}
                </div>
                {user.full_name && (
                  <p className="text-sm text-gray-600">{user.full_name}</p>
                )}
                {user.is_follower && (
                  <span className="text-xs text-gray-500">Follows you</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.is_following ? (
                <>
                  <button
                    onClick={() => handleCall(user.id, 'voice')}
                    className="btn btn-success"
                    title="Voice Call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => handleCall(user.id, 'video')}
                    className="btn btn-primary"
                    title="Video Call"
                  >
                    📹
                  </button>
                  <button
                    onClick={() => handleUnfollow(user.id)}
                    className="btn btn-secondary"
                  >
                    Following
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleFollow(user.id)}
                  className="btn btn-primary"
                >
                  Follow
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

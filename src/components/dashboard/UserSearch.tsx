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
  const [actionLoading, setActionLoading] = useState<string | null>(null)
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
    setActionLoading(userId)
    const success = await followUser(userId)
    if (success) {
      setFollowingIds(prev => new Set([...prev, userId]))
      setResults(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: true } : u
      ))
    }
    setActionLoading(null)
  }

  const handleUnfollow = async (userId: string) => {
    setActionLoading(userId)
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
    setActionLoading(null)
  }

  const handleCall = async (userId: string, callType: 'voice' | 'video') => {
    setActionLoading(userId)
    await initiateCall(userId, callType)
    setActionLoading(null)
  }

  return (
    <div>
      {/* Search Input */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or name..."
          className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">No users found for "{query}"</p>
          <p className="text-gray-500 text-xs mt-1">Try a different search term</p>
        </div>
      )}

      {/* Initial State */}
      {!loading && results.length === 0 && query.trim().length < 2 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">Search for users to follow</p>
          <p className="text-gray-500 text-xs mt-1">Type at least 2 characters</p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((searchUser) => (
          <div
            key={searchUser.id}
            className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                {searchUser.avatar_url ? (
                  <img src={searchUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  searchUser.username[0].toUpperCase()
                )}
              </div>
              {searchUser.is_online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{searchUser.username}</span>
                {searchUser.is_verified && (
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              {searchUser.full_name && (
                <p className="text-sm text-gray-400 truncate">{searchUser.full_name}</p>
              )}
              {searchUser.is_follower && (
                <span className="text-xs text-purple-400">Follows you</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {searchUser.is_following ? (
                <>
                  {/* Call buttons for following users */}
                  {searchUser.is_online && (
                    <>
                      <button
                        onClick={() => handleCall(searchUser.id, 'voice')}
                        disabled={actionLoading === searchUser.id}
                        className="p-2 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
                        title="Voice call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleCall(searchUser.id, 'video')}
                        disabled={actionLoading === searchUser.id}
                        className="p-2 rounded-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
                        title="Video call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleUnfollow(searchUser.id)}
                    disabled={actionLoading === searchUser.id}
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    {actionLoading === searchUser.id ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      'Following'
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleFollow(searchUser.id)}
                  disabled={actionLoading === searchUser.id}
                  className="px-4 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  {actionLoading === searchUser.id ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    'Follow'
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

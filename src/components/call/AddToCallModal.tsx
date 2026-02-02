'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { addParticipantToCall, getCallParticipants } from '@/lib/groupCalls'
import { searchUsers } from '@/lib/search'

interface AddToCallModalProps {
  isOpen: boolean
  callId: string
  onClose: () => void
  onUserAdded: (userId: string) => void
}

export default function AddToCallModal({ isOpen, callId, onClose, onUserAdded }: AddToCallModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [existingParticipants, setExistingParticipants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && callId) {
      loadFollowing()
      loadExistingParticipants()
    }
  }, [isOpen, callId])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadFollowing = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('follows')
        .select(`
          following:following_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('follower_id', user.id)

      if (!error && data) {
        setFollowing(data.map(d => d.following))
      }
    } catch (error) {
      console.error('Error loading following:', error)
    }
  }

  const loadExistingParticipants = async () => {
    try {
      const participants = await getCallParticipants(callId)
      setExistingParticipants(participants.map(p => p.user_id))
    } catch (error) {
      console.error('Error loading participants:', error)
    }
  }

  const handleSearch = async () => {
    try {
      setLoading(true)
      const results = await searchUsers(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (user: any) => {
    if (adding || existingParticipants.includes(user.id)) return

    try {
      setAdding(user.id)
      await addParticipantToCall(callId, user.id)
      setExistingParticipants(prev => [...prev, user.id])
      onUserAdded(user.id)
    } catch (error) {
      console.error('Error adding user to call:', error)
    } finally {
      setAdding(null)
    }
  }

  if (!isOpen) return null

  const usersToShow = searchQuery ? searchResults : following

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Add People to Call</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="text-xs text-gray-500 mb-2">
            {searchQuery ? 'Search Results' : 'People you follow'}
          </p>
          <div className="space-y-1">
            {usersToShow.map(user => {
              const isInCall = existingParticipants.includes(user.id)
              const isAdding = adding === user.id

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.username}
                      width={44}
                      height={44}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white font-medium">{user.full_name || user.username}</p>
                    <p className="text-sm text-gray-400">@{user.username}</p>
                  </div>
                  {isInCall ? (
                    <span className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-slate-800">
                      In call
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddUser(user)}
                      disabled={isAdding}
                      className="px-4 py-1.5 bg-cyan-500 text-white text-sm font-medium rounded-full hover:bg-cyan-600 transition-colors disabled:opacity-50"
                    >
                      {isAdding ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        'Add'
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {usersToShow.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {loading ? 'Searching...' : searchQuery ? 'No users found' : 'Follow people to add them to calls'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { createGroup } from '@/lib/groups'
import { searchUsers } from '@/lib/search'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (groupId: string) => void
}

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [step, setStep] = useState<'info' | 'members'>('info')
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedMembers, setSelectedMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [following, setFollowing] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      loadFollowing()
    }
  }, [isOpen])

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

  const toggleMember = (user: any) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === user.id)
      if (exists) {
        return prev.filter(m => m.id !== user.id)
      }
      return [...prev, user]
    })
  }

  const handleCreate = async () => {
    if (!groupName.trim()) return

    try {
      setCreating(true)
      const memberIds = selectedMembers.map(m => m.id)
      const group = await createGroup(groupName.trim(), groupDescription.trim(), memberIds)
      onGroupCreated(group.id)
      handleClose()
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setStep('info')
    setGroupName('')
    setGroupDescription('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedMembers([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {step === 'members' && (
              <button onClick={() => setStep('info')} className="p-1 hover:bg-slate-800 rounded-full">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-white font-semibold">
              {step === 'info' ? 'Create Group' : 'Add Members'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'info' ? (
            <div className="p-4 space-y-4">
              {/* Group Avatar Placeholder */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>

              {/* Group Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  maxLength={50}
                />
              </div>

              {/* Group Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows={3}
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  maxLength={200}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users to add..."
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map(member => (
                    <div 
                      key={member.id}
                      className="flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-full text-sm"
                    >
                      <span>{member.username}</span>
                      <button 
                        onClick={() => toggleMember(member)}
                        className="hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search Results or Following */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">
                  {searchQuery ? 'Search Results' : 'People you follow'}
                </p>
                {(searchQuery ? searchResults : following).map(user => {
                  const isSelected = selectedMembers.find(m => m.id === user.id)
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleMember(user)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-500/20' : 'hover:bg-slate-800'
                      }`}
                    >
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={user.username}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {user.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-medium">{user.full_name || user.username}</p>
                        <p className="text-sm text-gray-400">@{user.username}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          {step === 'info' ? (
            <button
              onClick={() => setStep('members')}
              disabled={!groupName.trim()}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? 'Creating...' : `Create Group${selectedMembers.length > 0 ? ` with ${selectedMembers.length} members` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

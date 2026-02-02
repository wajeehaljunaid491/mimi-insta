'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import {
  getGroupDetails,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateGroup,
  deleteGroup,
  GroupMember
} from '@/lib/groups'
import { searchUsers } from '@/lib/search'

interface GroupSettingsProps {
  groupId: string
  onClose: () => void
  onGroupDeleted: () => void
}

export default function GroupSettings({ groupId, onClose, onGroupDeleted }: GroupSettingsProps) {
  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Edit mode
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Add members
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [addingMember, setAddingMember] = useState<string | null>(null)
  
  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null)

  useEffect(() => {
    loadData()
    getCurrentUser()
  }, [groupId])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupData, membersData] = await Promise.all([
        getGroupDetails(groupId),
        getGroupMembers(groupId)
      ])
      setGroup(groupData)
      setMembers(membersData)
      setEditName(groupData.name)
      setEditDescription(groupData.description || '')
      
      // Check if current user is admin (creator)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && groupData.created_by === user.id) {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error('Error loading group:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const results = await searchUsers(query)
      // Filter out existing members
      const memberIds = members.map(m => m.user_id)
      setSearchResults(results.filter(r => !memberIds.includes(r.id)))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleAddMember = async (userId: string) => {
    setAddingMember(userId)
    try {
      await addGroupMember(groupId, userId)
      await loadData()
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Failed to add member')
    } finally {
      setAddingMember(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    
    try {
      await removeGroupMember(groupId, memberToRemove.user_id)
      await loadData()
      setMemberToRemove(null)
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member')
    }
  }

  const handleSaveChanges = async () => {
    if (!editName.trim()) return
    
    setSaving(true)
    try {
      await updateGroup(groupId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      })
      await loadData()
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating group:', error)
      alert('Failed to update group')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup(groupId)
      onGroupDeleted()
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white font-semibold text-lg">Group Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group Info */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {group?.name?.charAt(0).toUpperCase() || 'G'}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Group name"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-white text-xl font-bold">{group?.name}</h2>
                  <p className="text-gray-400 text-sm">{group?.description || 'No description'}</p>
                </>
              )}
            </div>
          </div>
          
          {isAdmin && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditName(group?.name || '')
                      setEditDescription(group?.description || '')
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Edit Group Info
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">{members.length} Members</h3>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Member
              </button>
            )}
          </div>

          {/* Add Member Search */}
          {showAddMember && isAdmin && (
            <div className="mb-4 p-4 bg-slate-800/50 rounded-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search users to add..."
                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
              />
              
              {searching && (
                <div className="text-center py-2">
                  <div className="inline-block w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt="" width={32} height={32} className="rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                            {user.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-white text-sm">{user.username}</span>
                      </div>
                      <button
                        onClick={() => handleAddMember(user.id)}
                        disabled={addingMember === user.id}
                        className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded-lg disabled:opacity-50"
                      >
                        {addingMember === user.id ? '...' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  {member.profiles?.avatar_url ? (
                    <Image
                      src={member.profiles.avatar_url}
                      alt={member.profiles.username}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {member.profiles?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <p className="text-white">{member.profiles?.full_name || member.profiles?.username}</p>
                    <p className="text-xs text-gray-400">@{member.profiles?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'admin' && (
                    <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">Admin</span>
                  )}
                  {isAdmin && member.user_id !== currentUserId && member.role !== 'admin' && (
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        {isAdmin && (
          <div className="p-4 mt-4 border-t border-slate-700/50">
            <h3 className="text-red-400 font-semibold mb-4">Danger Zone</h3>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Group
            </button>
          </div>
        )}
      </div>

      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-2">Remove Member</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.profiles?.username}</strong> from the group?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-2">Delete Group</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete <strong className="text-white">{group?.name}</strong>? This action cannot be undone and all messages will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { 
  getGroupDetails, 
  getGroupMembers, 
  getGroupMessages, 
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  subscribeToGroupMessages,
  GroupMessage,
  GroupMember
} from '@/lib/groups'
import { startGroupCall } from '@/lib/groupCalls'
import GroupSettings from './GroupSettings'

interface GroupChatProps {
  groupId: string
  onClose: () => void
  onStartCall: (callId: string, callType: 'voice' | 'video') => void
}

export default function GroupChat({ groupId, onClose, onStartCall }: GroupChatProps) {
  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGroup()
    getCurrentUser()
  }, [groupId])

  useEffect(() => {
    if (!groupId) return

    const channel = subscribeToGroupMessages(groupId, (message) => {
      setMessages(prev => {
        // Check if message already exists
        if (prev.find(m => m.id === message.id)) return prev
        return [...prev, message]
      })
      scrollToBottom()
    })

    // Also subscribe to deletes and updates
    const changesChannel = supabase
      .channel(`group-messages-changes-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          setMessages(prev => prev.map(m => 
            m.id === payload.new.id ? { ...m, ...payload.new } : m
          ))
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      changesChannel.unsubscribe()
    }
  }, [groupId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  const loadGroup = async () => {
    try {
      setLoading(true)
      const [groupData, membersData, messagesData] = await Promise.all([
        getGroupDetails(groupId),
        getGroupMembers(groupId),
        getGroupMessages(groupId)
      ])
      setGroup(groupData)
      setMembers(membersData)
      setMessages(messagesData)
    } catch (error) {
      console.error('Error loading group:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    try {
      setSending(true)
      await sendGroupMessage(groupId, newMessage.trim())
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleStartCall = async (type: 'voice' | 'video') => {
    try {
      const call = await startGroupCall(groupId, type)
      onStartCall(call.id, type)
    } catch (error) {
      console.error('Error starting call:', error)
    }
  }

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
    setSelectedMessageId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return

    try {
      await editGroupMessage(editingMessageId, editingContent.trim())
      setEditingMessageId(null)
      setEditingContent('')
    } catch (error) {
      console.error('Error editing message:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleDelete = async (messageId: string) => {
    try {
      await deleteGroupMessage(messageId)
      setSelectedMessageId(null)
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setShowMembers(!showMembers)}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {group?.name?.charAt(0).toUpperCase() || 'G'}
            </div>
            <div>
              <h2 className="text-white font-semibold">{group?.name}</h2>
              <p className="text-xs text-gray-400">{members.length} members</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStartCall('voice')}
            className="p-2.5 hover:bg-slate-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button
            onClick={() => handleStartCall('video')}
            className="p-2.5 hover:bg-slate-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 hover:bg-slate-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Members Dropdown */}
      {showMembers && (
        <div className="absolute top-16 left-4 right-4 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-white font-semibold">Members</h3>
          </div>
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-slate-700/50">
              <div className="relative">
                {member.profiles?.avatar_url ? (
                  <Image
                    src={member.profiles.avatar_url}
                    alt={member.profiles.username}
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                    {member.profiles?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm">{member.profiles?.full_name || member.profiles?.username}</p>
                <p className="text-xs text-gray-400">@{member.profiles?.username}</p>
              </div>
              {member.role === 'admin' && (
                <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">Admin</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" onClick={() => {
        setSelectedMessageId(null)
        setShowMembers(false)
      }}>
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          const isSelected = selectedMessageId === msg.id

          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className="relative max-w-[75%]">
                {!isMine && (
                  <div className="flex items-center gap-2 mb-1">
                    {msg.profiles?.avatar_url ? (
                      <Image
                        src={msg.profiles.avatar_url}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[8px] font-bold">
                        {msg.profiles?.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-400">{msg.profiles?.username}</span>
                  </div>
                )}
                
                <div
                  className={`rounded-2xl px-4 py-2.5 cursor-pointer ${
                    isMine
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-br-md'
                      : 'bg-slate-800 text-white rounded-bl-md'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedMessageId(isSelected ? null : msg.id)
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
                    {msg.is_edited && (
                      <span className="text-[10px] opacity-50 italic">edited</span>
                    )}
                  </div>
                </div>

                {/* Message Options */}
                {isSelected && (
                  <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden`}>
                    {isMine && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEdit(msg.id, msg.content)
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-slate-700/50 flex items-center gap-2 whitespace-nowrap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(msg.id)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-2 whitespace-nowrap ${isMine ? 'border-t border-slate-700' : ''}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit UI */}
      {editingMessageId && (
        <div className="px-4 py-3 bg-cyan-500/10 border-t border-cyan-500/30 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-cyan-400 mb-1">Editing message</p>
            <input
              type="text"
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              autoFocus
            />
          </div>
          <button onClick={handleCancelEdit} className="p-2 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={handleSaveEdit} className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      {!editingMessageId && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-slate-800 text-white rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showSettings && (
        <GroupSettings
          groupId={groupId}
          onClose={() => {
            setShowSettings(false)
            loadGroup() // Refresh group data
          }}
          onGroupDeleted={onClose}
        />
      )}
    </div>
  )
}

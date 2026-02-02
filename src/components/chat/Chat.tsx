'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { 
  Message, 
  Conversation, 
  getConversations, 
  getMessages, 
  sendMessage, 
  markMessagesAsRead,
  subscribeToMessages,
  unsubscribeFromMessages,
  getUnreadCount,
  deleteMessage,
  deleteMessages,
  editMessage,
  deleteChat
} from '@/lib/messages'
import { getFollowing } from '@/lib/follows'
import { initiateCall } from '@/lib/calls'
import { CallSounds } from '@/lib/sounds'
import { RealtimeChannel } from '@supabase/supabase-js'

interface ChatProps {
  onUnreadCountChange?: (count: number) => void
  openUserId?: string | null
  onOpenUserIdHandled?: () => void
}

interface FollowedUser {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

export default function Chat({ onUnreadCountChange, openUserId, onOpenUserIdHandled }: ChatProps) {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([])
  const [activeChat, setActiveChat] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showChatOptions, setShowChatOptions] = useState(false)
  const [callingUser, setCallingUser] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const activeChatRef = useRef<Conversation | null>(null)

  // Keep activeChatRef in sync
  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  // Load conversations and followed users
  useEffect(() => {
    if (user) {
      loadConversations()
      loadFollowedUsers()
      setupRealtimeSubscription()
    }

    return () => {
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current)
      }
      stopRecording()
    }
  }, [user])

  // Update unread count
  useEffect(() => {
    if (user && onUnreadCountChange) {
      getUnreadCount().then(onUnreadCountChange)
    }
  }, [user, conversations, onUnreadCountChange])

  // Handle opening chat with specific user from external trigger
  useEffect(() => {
    if (openUserId && user && !loading) {
      // Check if we already have a conversation with this user
      const existingConvo = conversations.find(c => c.user.id === openUserId)
      if (existingConvo) {
        openChat(existingConvo)
      } else {
        // Create a new conversation placeholder
        const userToChat = followedUsers.find(f => f.id === openUserId)
        if (userToChat) {
          const newConvo: Conversation = {
            user: {
              id: userToChat.id,
              username: userToChat.username,
              full_name: userToChat.full_name,
              avatar_url: userToChat.avatar_url,
              is_online: false
            },
            lastMessage: null,
            unreadCount: 0
          }
          setActiveChat(newConvo)
          setMessages([])
        }
      }
      // Clear the openUserId after handling
      onOpenUserIdHandled?.()
    }
  }, [openUserId, user, loading, conversations, followedUsers])

  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return

    channelRef.current = subscribeToMessages(
      user.id,
      (newMsg) => {
        // Add to messages if in active chat (use ref for latest value)
        const currentChat = activeChatRef.current
        if (currentChat && (newMsg.sender_id === currentChat.user.id)) {
          setMessages(prev => [...prev, newMsg])
          markMessagesAsRead(newMsg.sender_id)
          scrollToBottom()
        }
        // Update conversations list
        loadConversations()
        // Play notification sound
        CallSounds.playMessageNotification()
      },
      (messageId) => {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, is_read: true } : m
        ))
      },
      // Handle message deleted
      (messageId) => {
        setMessages(prev => prev.filter(m => m.id !== messageId))
        loadConversations()
      },
      // Handle message updated (edited)
      (updatedMsg) => {
        setMessages(prev => prev.map(m => 
          m.id === updatedMsg.id ? updatedMsg : m
        ))
      }
    )
  }, [user])

  const loadConversations = async () => {
    setLoading(true)
    const convos = await getConversations()
    setConversations(convos)
    setLoading(false)
  }

  const loadFollowedUsers = async () => {
    if (!user) return
    const following = await getFollowing(user.id)
    setFollowedUsers(following.map((f: any) => ({
      id: f.id,
      username: f.username,
      full_name: f.full_name,
      avatar_url: f.avatar_url
    })))
  }

  const openChat = async (conversation: Conversation) => {
    setActiveChat(conversation)
    setLoadingMessages(true)
    const msgs = await getMessages(conversation.user.id)
    setMessages(msgs)
    setLoadingMessages(false)
    
    // Mark messages as read
    if (conversation.unreadCount > 0) {
      await markMessagesAsRead(conversation.user.id)
      loadConversations() // Refresh to update unread counts
    }
    
    scrollToBottom()
  }

  // Start chat with a followed user
  const startChatWithUser = async (followedUser: FollowedUser) => {
    const conversation: Conversation = {
      user: {
        id: followedUser.id,
        username: followedUser.username,
        full_name: followedUser.full_name,
        avatar_url: followedUser.avatar_url,
        is_online: false
      },
      lastMessage: null,
      unreadCount: 0
    }
    await openChat(conversation)
  }

  const closeChat = () => {
    setActiveChat(null)
    setMessages([])
    setNewMessage('')
    stopRecording()
    setAudioBlob(null)
    setChatSearchQuery('')
    setShowChatSearch(false)
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      alert('Could not access microphone. Please grant permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    stopRecording()
    setAudioBlob(null)
    setRecordingTime(0)
  }

  const sendVoiceNote = async () => {
    if (!audioBlob || !activeChat) return

    setSendingMessage(true)
    
    // Convert blob to base64 for sending
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Audio = reader.result as string
      const msg = await sendMessage(activeChat.user.id, base64Audio, 'audio')
      if (msg) {
        setMessages(prev => [...prev, msg])
        setAudioBlob(null)
        setRecordingTime(0)
        scrollToBottom()
        loadConversations()
      }
      setSendingMessage(false)
    }
    reader.readAsDataURL(audioBlob)
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChat || sendingMessage) return

    setSendingMessage(true)
    const msg = await sendMessage(activeChat.user.id, newMessage)
    if (msg) {
      setMessages(prev => [...prev, msg])
      setNewMessage('')
      scrollToBottom()
      loadConversations() // Update conversation list
    }
    setSendingMessage(false)
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Now'
    if (diffMins < 60) return `${diffMins}m`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Get followed users that don't have conversations yet
  const followedWithoutConvo = followedUsers.filter(
    fu => !conversations.some(c => c.user.id === fu.id)
  )

  // Filter conversations and followed users based on search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.user.username.toLowerCase().includes(query) ||
      (conv.user.full_name?.toLowerCase().includes(query)) ||
      (conv.lastMessage?.content.toLowerCase().includes(query))
    )
  })

  const filteredFollowed = followedWithoutConvo.filter(fu => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      fu.username.toLowerCase().includes(query) ||
      (fu.full_name?.toLowerCase().includes(query))
    )
  })

  // Filter messages in active chat
  const filteredMessages = messages.filter(msg => {
    if (!chatSearchQuery.trim()) return true
    if (msg.message_type === 'audio') return false // Can't search audio
    return msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase())
  })

  // Conversations List View
  if (!activeChat) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Messages
          </h2>
          
          {/* Search Bar */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search people or messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : (filteredConversations.length === 0 && filteredFollowed.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {searchQuery ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                )}
              </svg>
            </div>
            <p className="text-gray-400 text-sm">
              {searchQuery ? `No results for "${searchQuery}"` : 'No messages yet'}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {searchQuery ? 'Try a different search' : 'Follow users to start chatting'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Active Conversations */}
            {filteredConversations.length > 0 && (
              <>
                <div className="px-4 py-2 bg-slate-800/50">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Conversations</span>
                </div>
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.user.id}
                    onClick={() => openChat(conv)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/30 transition-colors border-b border-slate-700/50"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                        {conv.user.avatar_url ? (
                          <img src={conv.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          conv.user.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      {conv.user.is_online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg shadow-emerald-500/50"></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-white truncate">
                          {conv.user.full_name || conv.user.username}
                        </p>
                        {conv.lastMessage && (
                          <span className="text-xs text-gray-500">{formatTime(conv.lastMessage.created_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-sm text-gray-400 truncate">
                          {conv.lastMessage?.message_type === 'audio' 
                            ? '🎵 Voice message' 
                            : (conv.lastMessage?.content || 'No messages')}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 min-w-[20px] h-5 px-1.5 bg-cyan-500 text-white text-xs rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Followed Users without conversations */}
            {filteredFollowed.length > 0 && (
              <>
                <div className="px-4 py-2 bg-slate-800/50 mt-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Following</span>
                </div>
                {filteredFollowed.map((fu) => (
                  <button
                    key={fu.id}
                    onClick={() => startChatWithUser(fu)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/30 transition-colors border-b border-slate-700/50"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold overflow-hidden">
                        {fu.avatar_url ? (
                          <img src={fu.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          fu.username.charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-white truncate">{fu.full_name || fu.username}</p>
                      <p className="text-sm text-gray-500">@{fu.username}</p>
                    </div>
                    <div className="p-2 rounded-full bg-cyan-500/20 text-cyan-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // Handle call
  const handleCall = async (callType: 'voice' | 'video') => {
    if (!activeChat || callingUser) return
    setCallingUser(true)
    await initiateCall(activeChat.user.id, callType)
    setCallingUser(false)
  }

  // Handle delete message - deletes for both users
  const handleDeleteMessage = async (messageId: string) => {
    const success = await deleteMessage(messageId)
    if (success) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    }
    setSelectedMessageId(null)
  }

  // Handle edit message
  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditingContent(currentContent)
    setSelectedMessageId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return
    
    const success = await editMessage(editingMessageId, editingContent.trim())
    if (success) {
      setMessages(prev => prev.map(m => 
        m.id === editingMessageId 
          ? { ...m, content: editingContent.trim(), is_edited: true } 
          : m
      ))
    }
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  // Toggle message selection for multi-select
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Delete multiple selected messages
  const handleDeleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return
    
    const messageIds = Array.from(selectedMessages)
    const success = await deleteMessages(messageIds)
    
    if (success) {
      setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)))
    }

    setSelectedMessages(new Set())
    setIsSelectMode(false)
  }

  // Handle delete chat
  const handleDeleteChat = async () => {
    if (!activeChat || !confirm('Delete this entire conversation?')) return
    const success = await deleteChat(activeChat.user.id)
    if (success) {
      closeChat()
      loadConversations()
    }
    setShowChatOptions(false)
  }

  // Chat View
  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="border-b border-slate-700/50">
        <div className="flex items-center gap-2 p-3">
          <button 
            onClick={closeChat}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
              {activeChat.user.avatar_url ? (
                <img src={activeChat.user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                activeChat.user.username.charAt(0).toUpperCase()
              )}
            </div>
            {activeChat.user.is_online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg shadow-emerald-500/50"></div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{activeChat.user.full_name || activeChat.user.username}</p>
            <p className="text-xs text-gray-400">
              {activeChat.user.is_online ? (
                <span className="text-emerald-400">● Online</span>
              ) : 'Offline'}
            </p>
          </div>

          {/* Voice Call Button */}
          <button
            onClick={() => handleCall('voice')}
            disabled={callingUser || !activeChat.user.is_online}
            className={`p-2 rounded-lg transition-colors ${
              activeChat.user.is_online 
                ? 'hover:bg-emerald-500/20 text-emerald-400' 
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title={activeChat.user.is_online ? 'Voice call' : 'User is offline'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>

          {/* Video Call Button */}
          <button
            onClick={() => handleCall('video')}
            disabled={callingUser || !activeChat.user.is_online}
            className={`p-2 rounded-lg transition-colors ${
              activeChat.user.is_online 
                ? 'hover:bg-cyan-500/20 text-cyan-400' 
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title={activeChat.user.is_online ? 'Video call' : 'User is offline'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Search button in chat */}
          <button
            onClick={() => setShowChatSearch(!showChatSearch)}
            className={`p-2 rounded-lg transition-colors ${showChatSearch ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-700/50 text-gray-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* More Options */}
          <div className="relative">
            <button
              onClick={() => setShowChatOptions(!showChatOptions)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* Options Dropdown */}
            {showChatOptions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setIsSelectMode(true)
                    setShowChatOptions(false)
                  }}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Select Messages
                </button>
                <button
                  onClick={handleDeleteChat}
                  className="w-full px-4 py-3 text-left text-red-400 hover:bg-slate-700/50 flex items-center gap-3 transition-colors border-t border-slate-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Search Bar */}
        {showChatSearch && (
          <div className="px-3 pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search in conversation..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
              {chatSearchQuery && (
                <button
                  onClick={() => setChatSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {chatSearchQuery && (
              <p className="text-xs text-gray-500 mt-2 px-1">
                {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        )}

        {/* Select Mode Bar */}
        {isSelectMode && (
          <div className="px-3 pb-3 flex items-center justify-between bg-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedMessages(new Set())
                }}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-sm text-gray-300">
                {selectedMessages.size} selected
              </span>
            </div>
            {selectedMessages.size > 0 && (
              <button
                onClick={() => handleDeleteSelectedMessages()}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete ({selectedMessages.size})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="auto">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-400 text-sm">No messages yet</p>
              <p className="text-gray-500 text-xs mt-1">Send a message to start chatting</p>
            </div>
          </div>
        ) : chatSearchQuery && filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-400 text-sm">No messages found</p>
              <p className="text-gray-500 text-xs mt-1">Try a different search term</p>
            </div>
          </div>
        ) : (
          (chatSearchQuery ? filteredMessages : messages).map((msg) => {
            const isMine = msg.sender_id === user?.id
            const isVoice = msg.message_type === 'audio'
            const isDeleted = (msg as any).deleted_for_everyone
            const isSelected = selectedMessageId === msg.id
            const isChecked = selectedMessages.has(msg.id)
            
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} relative group items-center gap-2`}
              >
                {/* Checkbox for select mode */}
                {isSelectMode && (
                  <button
                    onClick={() => toggleMessageSelection(msg.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isChecked 
                        ? 'bg-cyan-500 border-cyan-500' 
                        : 'border-gray-500 hover:border-cyan-400'
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                <div
                  onClick={() => {
                    if (isSelectMode) {
                      toggleMessageSelection(msg.id)
                    } else {
                      setSelectedMessageId(isSelected ? null : msg.id)
                    }
                  }}
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl cursor-pointer transition-all ${
                    isMine
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-md'
                      : 'bg-slate-700 text-white rounded-bl-md'
                  } ${isSelected && !isSelectMode ? 'ring-2 ring-cyan-400' : ''} ${isChecked ? 'ring-2 ring-cyan-500' : ''}`}
                >
                  {isDeleted ? (
                    <p className="text-sm italic opacity-60">This message was deleted</p>
                  ) : isVoice ? (
                    <div className="flex items-center gap-3">
                      <button 
                        className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          const audio = new Audio(msg.content)
                          audio.play()
                        }}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">🎵 Voice message</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{msg.content}</p>
                  )}
                  <div className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
                    {(msg as any).is_edited && (
                      <span className="text-[10px] opacity-50 italic">edited</span>
                    )}
                    {isMine && !isDeleted && (
                      <span className={`text-[10px] ${msg.is_read ? 'text-cyan-300' : 'opacity-60'}`}>
                        {msg.is_read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Options Popup */}
                {isSelected && !isSelectMode && !isDeleted && (
                  <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden`}>
                    {/* Edit - only for sender */}
                    {isMine && !isVoice && (
                      <button
                        onClick={() => handleStartEdit(msg.id, msg.content)}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-slate-700/50 flex items-center gap-2 whitespace-nowrap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    )}
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className={`w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-2 whitespace-nowrap ${isMine && !isVoice ? 'border-t border-slate-700' : ''}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit Message UI */}
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
          <button
            onClick={handleCancelEdit}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={!editingContent.trim()}
            className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Voice Recording UI */}
      {isRecording && (
        <div className="px-4 py-3 bg-red-500/20 border-t border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white font-medium">Recording {formatRecordingTime(recordingTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={stopRecording}
              className="p-2 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Voice Note Preview */}
      {audioBlob && !isRecording && (
        <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const url = URL.createObjectURL(audioBlob)
                const audio = new Audio(url)
                audio.play()
              }}
              className="p-2 bg-cyan-500/20 text-cyan-400 rounded-full hover:bg-cyan-500/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <span className="text-white text-sm">Voice note ready ({formatRecordingTime(recordingTime)})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={sendVoiceNote}
              disabled={sendingMessage}
              className="p-2 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 disabled:opacity-50 transition-colors"
            >
              {sendingMessage ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      {!isRecording && !audioBlob && (
        <form onSubmit={handleSend} className="p-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* Voice Record Button */}
            <button
              type="button"
              onClick={startRecording}
              className="p-3 bg-slate-700/50 hover:bg-slate-700 text-gray-400 hover:text-cyan-400 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
              dir="auto"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sendingMessage}
              className="p-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-cyan-500/25"
            >
              {sendingMessage ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

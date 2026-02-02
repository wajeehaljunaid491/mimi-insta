'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getCallHistoryPaginated, deleteCall, deleteAllCallHistory } from '@/lib/calls'

interface CallLog {
  id: string
  caller_id: string
  receiver_id: string
  call_type: 'voice' | 'video'
  status: string
  started_at: string
  duration_seconds: number
  caller: { username: string; avatar_url: string | null } | null
  receiver: { username: string; avatar_url: string | null } | null
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const { user } = useAuthStore()

  const PAGE_SIZE = 10

  useEffect(() => {
    if (user) {
      loadCalls()
    }
  }, [user])

  const loadCalls = async () => {
    setLoading(true)
    const result = await getCallHistoryPaginated(0, PAGE_SIZE)
    setCalls(result.calls)
    setHasMore(result.hasMore)
    setPage(0)
    setLoading(false)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const nextPage = page + 1
    const result = await getCallHistoryPaginated(nextPage, PAGE_SIZE)
    setCalls(prev => [...prev, ...result.calls])
    setHasMore(result.hasMore)
    setPage(nextPage)
    setLoadingMore(false)
  }

  const handleDelete = async (callId: string) => {
    setDeletingId(callId)
    const success = await deleteCall(callId)
    if (success) {
      setCalls(prev => prev.filter(c => c.id !== callId))
    }
    setDeletingId(null)
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL call history? This cannot be undone.')) return
    
    setShowDeleteAll(false)
    setLoading(true)
    const success = await deleteAllCallHistory()
    if (success) {
      setCalls([])
    }
    setLoading(false)
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return ''
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getCallStatus = (call: CallLog) => {
    const isCaller = call.caller_id === user?.id
    
    switch (call.status) {
      case 'ended':
        return {
          icon: call.call_type === 'video' ? (
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
          text: formatDuration(call.duration_seconds) || 'Completed',
          color: 'text-green-400'
        }
      case 'missed':
        return {
          icon: (
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          ),
          text: isCaller ? 'No answer' : 'Missed',
          color: 'text-red-400'
        }
      case 'rejected':
        return {
          icon: (
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ),
          text: isCaller ? 'Declined' : 'Rejected',
          color: 'text-orange-400'
        }
      case 'cancelled':
        return {
          icon: (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          text: 'Cancelled',
          color: 'text-gray-400'
        }
      default:
        return {
          icon: (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
          text: call.status,
          color: 'text-gray-400'
        }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">No call history yet</p>
        <p className="text-gray-500 text-xs mt-1">Your calls will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Delete All Button */}
      {calls.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowDeleteAll(true)}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </button>
        </div>
      )}

      {/* Confirm Delete All Modal */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Delete All History?</h3>
            <p className="text-gray-400 text-sm text-center mb-6">This will permanently delete all your call history. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAll(false)}
                className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 rounded-xl text-white font-medium transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call List */}
      {calls.map((call) => {
        const isCaller = call.caller_id === user?.id
        const otherUser = isCaller ? call.receiver : call.caller
        const otherUsername = otherUser?.username || 'Unknown'
        const status = getCallStatus(call)
        
        return (
          <div
            key={call.id}
            className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors group"
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
              {otherUser?.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                otherUsername?.charAt(0).toUpperCase() || '?'
              )}
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{otherUsername}</span>
                <span className="text-gray-500 text-xs">
                  {isCaller ? '↗' : '↙'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {status.icon}
                <span className={`text-xs ${status.color}`}>{status.text}</span>
              </div>
            </div>

            {/* Time & Delete */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{formatDate(call.started_at)}</span>
              <button
                onClick={() => handleDelete(call.id)}
                disabled={deletingId === call.id}
                className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                {deletingId === call.id ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )
      })}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"></div>
              Loading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Load More
            </>
          )}
        </button>
      )}
    </div>
  )
}

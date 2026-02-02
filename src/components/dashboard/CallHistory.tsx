'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'

interface CallLog {
  id: string
  caller_id: string
  receiver_id: string
  call_type: 'voice' | 'video'
  status: string
  started_at: string
  duration_seconds: number
  caller_username: string
  receiver_username: string
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) return

    const loadCallHistory = async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id,
          caller_id,
          receiver_id,
          call_type,
          status,
          started_at,
          duration_seconds,
          caller:profiles!call_logs_caller_id_fkey(username),
          receiver:profiles!call_logs_receiver_id_fkey(username)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('started_at', { ascending: false })
        .limit(20)

      if (data) {
        const formattedCalls = data.map((call: any) => ({
          ...call,
          caller_username: call.caller?.username || 'Unknown',
          receiver_username: call.receiver?.username || 'Unknown',
        }))
        setCalls(formattedCalls)
      }
      setLoading(false)
    }

    loadCallHistory()
  }, [user])

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getCallIcon = (call: CallLog) => {
    const isCaller = call.caller_id === user?.id
    const isVideo = call.call_type === 'video'
    
    if (call.status === 'missed' && !isCaller) return '❌'
    if (call.status === 'rejected') return '🚫'
    if (isVideo) return '📹'
    return '📞'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ended': return 'text-green-600'
      case 'missed': return 'text-red-600'
      case 'rejected': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No call history yet
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => {
        const isCaller = call.caller_id === user?.id
        const otherUsername = isCaller ? call.receiver_username : call.caller_username
        
        return (
          <div
            key={call.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {getCallIcon(call)}
              </div>
              
              <div>
                <div className="font-medium">
                  {isCaller ? '→' : '←'} {otherUsername}
                </div>
                <div className={`text-sm ${getStatusColor(call.status)}`}>
                  {call.status === 'ended' && call.duration_seconds > 0
                    ? formatDuration(call.duration_seconds)
                    : call.status}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              {formatDate(call.started_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

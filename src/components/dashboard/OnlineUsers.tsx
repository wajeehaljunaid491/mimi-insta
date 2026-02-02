'use client'

import { useEffect, useState } from 'react'
import { usePresenceStore } from '@/store/presenceStore'
import { initiateCall } from '@/lib/calls'

export default function OnlineUsers() {
  const { onlineUsers } = usePresenceStore()
  const [mounted, setMounted] = useState(false)
  const [callingUser, setCallingUser] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="text-center py-4">Loading...</div>
  }

  const handleCall = async (userId: string, callType: 'voice' | 'video') => {
    setCallingUser(userId)
    const result = await initiateCall(userId, callType)
    if (!result) {
      alert('Failed to initiate call. Please try again.')
      setCallingUser(null)
    }
    // Don't reset callingUser here - the CallOverlay will take over
  }

  if (onlineUsers.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No users online
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {onlineUsers.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white font-bold text-sm">
                {user.username[0].toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
            </div>
            
            <div>
              <div className="font-medium text-sm">{user.username}</div>
              <div className="text-xs text-gray-500 capitalize">{user.status}</div>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => handleCall(user.id, 'voice')}
              disabled={callingUser === user.id}
              className={`p-2 rounded-lg transition-colors ${
                callingUser === user.id 
                  ? 'bg-green-200 animate-pulse' 
                  : 'hover:bg-green-100'
              }`}
              title="Voice Call"
            >
              📞
            </button>
            <button
              onClick={() => handleCall(user.id, 'video')}
              disabled={callingUser === user.id}
              className={`p-2 rounded-lg transition-colors ${
                callingUser === user.id 
                  ? 'bg-blue-200 animate-pulse' 
                  : 'hover:bg-blue-100'
              }`}
              title="Video Call"
            >
              📹
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

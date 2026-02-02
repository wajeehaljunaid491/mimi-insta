'use client'

import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'

export default function DashboardHeader() {
  const { profile, signOut } = useAuthStore()
  const { status, setStatus } = usePresenceStore()

  const statusOptions = [
    { value: 'available', label: '🟢 Available', color: 'bg-green-500' },
    { value: 'busy', label: '🔴 Busy', color: 'bg-red-500' },
    { value: 'offline', label: '⚫ Offline', color: 'bg-gray-500' },
  ]

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-white ${
            statusOptions.find(s => s.value === status)?.color || 'bg-gray-500'
          }`}></span>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {profile?.full_name || profile?.username || 'User'}!
          </h1>
          <p className="text-gray-600">@{profile?.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          onClick={signOut}
          className="btn btn-secondary"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

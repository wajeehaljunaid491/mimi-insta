'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePresenceStore } from '@/store/presenceStore'

export default function DashboardHeader() {
  const { profile, signOut } = useAuthStore()
  const { status, setStatus } = usePresenceStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const statusOptions = [
    { value: 'available', label: 'Available', icon: '🟢', color: 'bg-green-500' },
    { value: 'busy', label: 'Busy', icon: '🔴', color: 'bg-red-500' },
    { value: 'offline', label: 'Appear Offline', icon: '⚫', color: 'bg-gray-500' },
  ]

  const currentStatus = statusOptions.find(s => s.value === status) || statusOptions[0]

  return (
    <div className="flex items-center justify-between px-4 py-3">
      {/* Logo / App Name */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="font-bold text-lg text-white">Mimi</span>
      </div>

      {/* Right side - Status & Profile */}
      <div className="flex items-center gap-2">
        {/* Status Button */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors border border-slate-700/30"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${currentStatus.color}`}></span>
            <span className="text-sm text-gray-300 hidden sm:inline">{currentStatus.label}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Status Dropdown */}
          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                {statusOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStatus(option.value as any)
                      setShowStatusMenu(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                      status === option.value ? 'bg-slate-700/50' : ''
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${option.color}`}></span>
                    <span className="text-sm text-white">{option.label}</span>
                    {status === option.value && (
                      <svg className="w-4 h-4 text-cyan-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 p-1.5 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors border border-slate-700/30"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${currentStatus.color}`}></span>
            </div>
          </button>

          {/* Profile Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
              <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="font-medium text-white truncate">{profile?.full_name || profile?.username}</p>
                  <p className="text-sm text-gray-400 truncate">@{profile?.username}</p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      signOut()
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

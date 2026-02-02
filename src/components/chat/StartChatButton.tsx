'use client'

import { useState } from 'react'
import { sendMessage } from '@/lib/messages'

interface StartChatButtonProps {
  userId: string
  username: string
  onChatStarted?: () => void
}

export default function StartChatButton({ userId, username, onChatStarted }: StartChatButtonProps) {
  const [showInput, setShowInput] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return
    
    setSending(true)
    const result = await sendMessage(userId, message)
    setSending(false)
    
    if (result) {
      setMessage('')
      setShowInput(false)
      onChatStarted?.()
    }
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message ${username}...`}
          className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {sending ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
        <button
          onClick={() => {
            setShowInput(false)
            setMessage('')
          }}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="p-2.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
      title="Send message"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </button>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Story, getStories, createStory, viewStory, uploadStoryMedia, deleteStory, getStoryViewers } from '@/lib/stories'

interface StoryUser {
  userId: string
  user: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
  stories: Story[]
}

export default function Stories() {
  const { user } = useAuthStore()
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStory, setActiveStory] = useState<{ userIndex: number; storyIndex: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    loadStories()
  }, [])

  const loadStories = async () => {
    setLoading(true)
    const data = await getStories()
    setStoryUsers(data)
    setLoading(false)
  }

  const handleAddStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      console.log('Starting story upload...')
      const mediaUrl = await uploadStoryMedia(file)
      console.log('Media URL:', mediaUrl)
      
      if (mediaUrl) {
        const mediaType = file.type.startsWith('video') ? 'video' : 'image'
        console.log('Creating story with type:', mediaType)
        const story = await createStory(mediaUrl, mediaType)
        console.log('Story created:', story)
        
        if (story) {
          await loadStories()
        } else {
          alert('Failed to create story. Please try again.')
        }
      } else {
        alert('Failed to upload image. Please check your connection.')
      }
    } catch (err) {
      console.error('Error uploading story:', err)
      alert('Error uploading story. Please try again.')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openStory = async (userIndex: number, storyIndex: number = 0) => {
    setActiveStory({ userIndex, storyIndex })
    setProgress(0)
    
    const story = storyUsers[userIndex].stories[storyIndex]
    await viewStory(story.id)
    
    startProgress()
  }

  const startProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current)
    setProgress(0)
    
    // 30 seconds total: 100% / 0.333% per interval * 100ms = 30000ms
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          nextStory()
          return 0
        }
        return prev + 0.333 // 30 seconds total
      })
    }, 100)
  }

  const nextStory = () => {
    if (!activeStory) return
    
    const { userIndex, storyIndex } = activeStory
    const currentUser = storyUsers[userIndex]
    
    if (storyIndex < currentUser.stories.length - 1) {
      // Next story from same user
      openStory(userIndex, storyIndex + 1)
    } else if (userIndex < storyUsers.length - 1) {
      // Next user's stories
      openStory(userIndex + 1, 0)
    } else {
      // End of all stories
      closeStory()
    }
  }

  const prevStory = () => {
    if (!activeStory) return
    
    const { userIndex, storyIndex } = activeStory
    
    if (storyIndex > 0) {
      openStory(userIndex, storyIndex - 1)
    } else if (userIndex > 0) {
      const prevUser = storyUsers[userIndex - 1]
      openStory(userIndex - 1, prevUser.stories.length - 1)
    }
  }

  const closeStory = () => {
    if (progressRef.current) clearInterval(progressRef.current)
    setActiveStory(null)
    setShowViewers(false)
  }

  const handleDeleteStory = async () => {
    if (!activeStory) return
    const story = storyUsers[activeStory.userIndex].stories[activeStory.storyIndex]
    
    if (confirm('Delete this story?')) {
      await deleteStory(story.id)
      closeStory()
      loadStories()
    }
  }

  const loadViewers = async () => {
    if (!activeStory) return
    const story = storyUsers[activeStory.userIndex].stories[activeStory.storyIndex]
    const data = await getStoryViewers(story.id)
    setViewers(data)
    setShowViewers(true)
  }

  const currentStory = activeStory 
    ? storyUsers[activeStory.userIndex]?.stories[activeStory.storyIndex] 
    : null
  const currentUser = activeStory 
    ? storyUsers[activeStory.userIndex]?.user 
    : null
  const isMyStory = currentUser?.id === user?.id

  return (
    <>
      {/* Stories Bar */}
      <div className="flex gap-4 overflow-x-auto py-4 px-2 scrollbar-hide">
        {/* Add Story Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
              {uploading ? (
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
              ) : (
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-400">Add Story</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleAddStory}
          className="hidden"
        />

        {/* Story Circles */}
        {loading ? (
          <div className="flex gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-slate-700"></div>
                <div className="w-12 h-2 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          storyUsers.map((su, idx) => (
            <button
              key={su.userId}
              onClick={() => openStory(idx)}
              className="flex-shrink-0 flex flex-col items-center gap-1"
            >
              <div className="p-0.5 rounded-full bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500">
                <div className="w-[60px] h-[60px] rounded-full bg-slate-900 p-0.5">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                    {su.user.avatar_url ? (
                      <img src={su.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      su.user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400 truncate max-w-[64px]">
                {su.userId === user?.id ? 'Your story' : su.user.username}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeStory && currentStory && currentUser && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Progress Bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
            {storyUsers[activeStory.userIndex].stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-100"
                  style={{ 
                    width: idx < activeStory.storyIndex ? '100%' : 
                           idx === activeStory.storyIndex ? `${progress}%` : '0%' 
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-8 left-0 right-0 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentUser.username.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{currentUser.username}</p>
                <p className="text-white/60 text-xs">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMyStory && (
                <>
                  <button
                    onClick={loadViewers}
                    className="p-2 text-white/80 hover:text-white"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDeleteStory}
                    className="p-2 text-white/80 hover:text-red-400"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={closeStory}
                className="p-2 text-white/80 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Story Content */}
          <div className="w-full h-full flex items-center justify-center">
            {currentStory.media_type === 'video' ? (
              <video
                src={currentStory.media_url}
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img
                src={currentStory.media_url}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-20 left-0 right-0 px-4 text-center">
              <p className="text-white text-lg drop-shadow-lg">{currentStory.caption}</p>
            </div>
          )}

          {/* Navigation Touch Areas */}
          <div className="absolute inset-0 flex">
            <div className="w-1/3 h-full" onClick={prevStory}></div>
            <div className="w-1/3 h-full"></div>
            <div className="w-1/3 h-full" onClick={nextStory}></div>
          </div>

          {/* Views Count (for own stories) */}
          {isMyStory && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button
                onClick={loadViewers}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {currentStory.views_count} views
              </button>
            </div>
          )}

          {/* Viewers Panel */}
          {showViewers && (
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl max-h-[50%] overflow-y-auto z-20">
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-white font-semibold">Viewers</h3>
                <button onClick={() => setShowViewers(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                {viewers.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No viewers yet</p>
                ) : (
                  viewers.map(v => (
                    <div key={v.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                        {v.viewer?.avatar_url ? (
                          <img src={v.viewer.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          v.viewer?.username?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-white">{v.viewer?.username}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

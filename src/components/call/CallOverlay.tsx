'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { answerCall, rejectCall, endCall, cancelCall } from '@/lib/calls'
import { webRTCService } from '@/lib/webrtc'
import { CallSounds } from '@/lib/sounds'
import AddToCallModal from './AddToCallModal'

interface ActiveCall {
  id: string
  caller_id: string
  receiver_id: string
  caller_username: string
  receiver_username: string
  call_type: 'voice' | 'video'
  status: string
  is_caller: boolean
  started_at?: string
}

// Auto-cancel call after 60 seconds if no answer
const CALL_TIMEOUT_SECONDS = 60

export default function CallOverlay() {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(true)
  const [connectionState, setConnectionState] = useState<string>('')
  const [webrtcInitialized, setWebrtcInitialized] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [isEnding, setIsEnding] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [ringDuration, setRingDuration] = useState(0)
  const [showAddPeople, setShowAddPeople] = useState(false)
  
  const user = useAuthStore((state) => state.user)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const durationRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const endingCallId = useRef<string | null>(null)
  const ringTimerRef = useRef<NodeJS.Timeout | null>(null)
  const soundStarted = useRef<boolean>(false)

  // Play ringing sound
  const playRingSound = useCallback((isIncoming: boolean) => {
    if (soundStarted.current) return
    soundStarted.current = true
    
    try {
      if (isIncoming) {
        CallSounds.playIncomingRing()
      } else {
        CallSounds.playOutgoingRing()
      }
    } catch (err) {
      console.log('Ring sound error:', err)
    }
  }, [])

  // Stop ringing sound
  const stopRingSound = useCallback(() => {
    CallSounds.stop()
    soundStarted.current = false
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current)
      ringTimerRef.current = null
    }
    setRingDuration(0)
  }, [])

  // Auto-cancel call after timeout
  const autoCancelCall = useCallback(async (callId: string) => {
    console.log('Auto-cancelling call after timeout:', callId)
    stopRingSound()
    await cancelCall(callId)
    setActiveCall(null)
    setIsEnding(false)
    endingCallId.current = null
    window.location.reload()
  }, [stopRingSound])

  // Check for active calls
  const checkActiveCall = useCallback(async () => {
    if (!user) return
    
    // Don't check if we're in the process of ending a call
    if (isEnding) return

    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id,
          caller_id,
          receiver_id,
          call_type,
          status,
          started_at,
          caller:profiles!call_logs_caller_id_fkey(username),
          receiver:profiles!call_logs_receiver_id_fkey(username)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in('status', ['calling', 'ringing', 'accepted'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error checking call:', error)
        return
      }

      // Skip if this is a call we just ended
      if (data && endingCallId.current === data.id) {
        console.log('Ignoring call we are ending:', data.id)
        return
      }

      if (data) {
        const callData = data as any
        const newCall: ActiveCall = {
          id: callData.id,
          caller_id: callData.caller_id,
          receiver_id: callData.receiver_id,
          caller_username: callData.caller?.username || 'Unknown',
          receiver_username: callData.receiver?.username || 'Unknown',
          call_type: callData.call_type,
          status: callData.status,
          is_caller: callData.caller_id === user.id,
          started_at: callData.started_at,
        }
        
        setActiveCall(newCall)
      } else if (activeCall && !isEnding) {
        // Other user ended the call - cleanup and refresh
        console.log('Call ended by other user, cleaning up and refreshing')
        stopRingSound()
        webRTCService.cleanup()
        setWebrtcInitialized(false)
        setActiveCall(null)
        setCallDuration(0)
        setLocalStream(null)
        setRemoteStream(null)
        endingCallId.current = null
        // Refresh the page for this user too
        window.location.reload()
      }
    } catch (err) {
      console.error('Error checking active call:', err)
    }
  }, [user, activeCall, isEnding])

  // Fast polling for call status
  useEffect(() => {
    if (!user) return

    checkActiveCall()
    pollRef.current = setInterval(checkActiveCall, 1000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [user, checkActiveCall])

  // Handle ringing sound and auto-cancel timer
  useEffect(() => {
    if (!activeCall) {
      stopRingSound()
      return
    }

    // Play ringing sound when call is in calling/ringing state
    if (activeCall.status === 'calling' || activeCall.status === 'ringing') {
      // Start ring sound
      playRingSound(!activeCall.is_caller)
      
      // Start ring duration timer (for auto-cancel)
      if (!ringTimerRef.current) {
        ringTimerRef.current = setInterval(() => {
          setRingDuration(prev => {
            const newDuration = prev + 1
            // Auto-cancel if caller and exceeded timeout
            if (activeCall.is_caller && newDuration >= CALL_TIMEOUT_SECONDS) {
              autoCancelCall(activeCall.id)
            }
            return newDuration
          })
        }, 1000)
      }
    } else if (activeCall.status === 'accepted') {
      // Stop ringing when call is accepted
      stopRingSound()
    }

    return () => {
      // Cleanup on unmount or when activeCall changes
    }
  }, [activeCall?.id, activeCall?.status, activeCall?.is_caller, playRingSound, stopRingSound, autoCancelCall])

  // Cleanup ring sound on unmount
  useEffect(() => {
    return () => {
      stopRingSound()
    }
  }, [stopRingSound])

  // Initialize WebRTC when appropriate
  useEffect(() => {
    if (!activeCall) return
    
    const shouldInit = 
      (activeCall.status === 'accepted' || 
       (activeCall.is_caller && activeCall.status === 'calling')) && 
      !webrtcInitialized

    if (shouldInit) {
      console.log('Initializing WebRTC:', activeCall.id)
      setMediaError(null)
      
      webRTCService.initializeCall(
        activeCall.id,
        activeCall.call_type,
        activeCall.is_caller,
        {
          onLocalStream: (stream) => {
            console.log('Got local stream, tracks:', stream.getTracks().map(t => t.kind))
            setLocalStream(stream)
            // Set to video element
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream
              localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
            }
          },
          onRemoteStream: (stream) => {
            console.log('Got remote stream, tracks:', stream.getTracks().map(t => t.kind))
            setRemoteStream(stream)
            // Set to video element
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream
              remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e))
            }
          },
          onConnectionStateChange: (state) => {
            setConnectionState(state)
          },
          onError: (error) => {
            console.error('WebRTC Error:', error.message)
            setMediaError(error.message)
          },
          onPermissionDenied: (type) => {
            console.log('Permission denied for:', type)
          }
        }
      ).then(success => {
        setWebrtcInitialized(success)
        if (!success && !mediaError) {
          setMediaError('Camera/microphone access denied. Please check your browser settings.')
        }
      })
    }
  }, [activeCall?.id, activeCall?.status, activeCall?.is_caller, activeCall?.call_type, webrtcInitialized, mediaError])

  // Sync local stream to video element whenever it changes or ref becomes available
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Syncing local stream to video element')
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
    }
  }, [localStream, activeCall?.status])

  // Sync remote stream to video element whenever it changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Syncing remote stream to video element')
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e))
    }
  }, [remoteStream, activeCall?.status])

  // Call duration timer
  useEffect(() => {
    if (activeCall?.status === 'accepted') {
      durationRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (durationRef.current) clearInterval(durationRef.current)
      setCallDuration(0)
    }

    return () => {
      if (durationRef.current) clearInterval(durationRef.current)
    }
  }, [activeCall?.status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      webRTCService.cleanup()
    }
  }, [])

  // Handle page unload - end call when user leaves/refreshes
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (activeCall && !isEnding) {
        console.log('Page unloading, ending call:', activeCall.id)
        // Use synchronous XMLHttpRequest for beforeunload
        const xhr = new XMLHttpRequest()
        xhr.open('PATCH', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/call_logs?id=eq.${activeCall.id}`, false)
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.setRequestHeader('Prefer', 'return=minimal')
        xhr.send(JSON.stringify({
          status: activeCall.status === 'accepted' ? 'ended' : 'cancelled',
          ended_at: new Date().toISOString()
        }))
      }
    }

    const handleVisibilityChange = () => {
      // On iOS, visibilitychange is more reliable than beforeunload
      if (document.visibilityState === 'hidden' && activeCall && !isEnding) {
        // Try to end the call when page becomes hidden
        if (activeCall.status === 'accepted') {
          endCall(activeCall.id)
        } else {
          cancelCall(activeCall.id)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeCall, isEnding])

  const handleAnswer = async () => {
    if (!activeCall) return
    
    const success = await answerCall(activeCall.id)
    if (success) {
      setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : null)
      setTimeout(checkActiveCall, 500)
    }
  }

  const handleReject = async () => {
    if (!activeCall) return
    
    setIsEnding(true)
    endingCallId.current = activeCall.id
    
    // Stop polling
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    
    // Clear video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    webRTCService.cleanup()
    setWebrtcInitialized(false)
    
    await rejectCall(activeCall.id)
    
    // Clear all state
    setActiveCall(null)
    setCallDuration(0)
    setConnectionState('')
    setMediaError(null)
    
    // Refresh the page after rejecting to reset everything
    setTimeout(() => {
      setIsEnding(false)
      endingCallId.current = null
      setLocalStream(null)
      setRemoteStream(null)
      window.location.reload()
    }, 500)
  }

  const handleEnd = async () => {
    if (!activeCall || isEnding) return
    
    console.log('Ending call:', activeCall.id, 'status:', activeCall.status)
    
    setIsEnding(true)
    endingCallId.current = activeCall.id
    
    // Stop polling while ending
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    
    // Stop duration timer
    if (durationRef.current) {
      clearInterval(durationRef.current)
      durationRef.current = null
    }
    
    // Clear video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    // Cleanup WebRTC first
    webRTCService.cleanup()
    setWebrtcInitialized(false)
    
    // Use cancelCall if the call was never answered, otherwise use endCall
    const wasAnswered = activeCall.status === 'accepted'
    const success = wasAnswered 
      ? await endCall(activeCall.id)
      : await cancelCall(activeCall.id)
    
    console.log('Call end result:', success)
    
    // Clear all state and restart polling
    setActiveCall(null)
    setCallDuration(0)
    setConnectionState('')
    setMediaError(null)
    setIsMuted(false)
    setIsVideoOff(false)
    
    // Refresh the page after call ends to reset everything
    setTimeout(() => {
      setIsEnding(false)
      endingCallId.current = null
      setLocalStream(null)
      setRemoteStream(null)
      // Refresh the page to fully reset the dashboard
      window.location.reload()
    }, 500)
  }

  const handleToggleMute = () => {
    const newMuted = !isMuted
    webRTCService.toggleMute()
    setIsMuted(newMuted)
  }

  const handleToggleVideo = () => {
    const newVideoOff = !isVideoOff
    webRTCService.toggleVideo()
    setIsVideoOff(newVideoOff)
  }

  const handleToggleSpeaker = () => {
    setIsSpeaker(!isSpeaker)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!activeCall) return null

  const otherUsername = activeCall.is_caller
    ? activeCall.receiver_username
    : activeCall.caller_username

  const isIncoming = !activeCall.is_caller && activeCall.status === 'calling'
  const isConnected = activeCall.status === 'accepted'
  const isVideoCall = activeCall.call_type === 'video'

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 pt-8 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500' : 
            connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            'bg-gray-500'
          }`} />
          <span className="text-sm font-medium">
            {connectionState === 'connected' ? 'Connected' : 
             connectionState === 'connecting' ? 'Connecting...' : 
             isIncoming ? 'Incoming Call' : 'Calling...'}
          </span>
        </div>
        {isConnected && (
          <span className="text-xl font-mono font-bold">{formatDuration(callDuration)}</span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {isVideoCall && isConnected ? (
          <div className="relative w-full h-full max-w-md mx-auto flex items-center justify-center">
            {/* Remote video - portrait orientation for faces */}
            <div className="relative w-full h-full max-h-[80vh] aspect-[3/4] bg-gray-800 rounded-3xl overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <span className="text-white animate-pulse">Connecting video...</span>
                </div>
              )}
            </div>
            
            {/* Local video - small overlay in corner */}
            <div className="absolute bottom-6 right-6 w-24 h-32 sm:w-28 sm:h-36 aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
              {!localStream && !isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <span className="text-white text-xs animate-pulse">Loading...</span>
                </div>
              )}
              {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-700 text-white">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-xs">Off</span>
                </div>
              )}
            </div>

            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-2xl px-4 py-2">
              <p className="text-white font-bold text-lg">{otherUsername}</p>
            </div>
          </div>
        ) : isVideoCall && activeCall.is_caller && activeCall.status === 'calling' ? (
          /* Show local video preview for caller while calling */
          <div className="relative w-full h-full max-w-4xl flex flex-col items-center justify-center">
            {/* Local video preview - shows your own camera */}
            <div className="relative w-64 h-80 sm:w-80 sm:h-96 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/30 mb-6">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <span className="text-white animate-pulse">Loading camera...</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
                <span className="text-white text-xs">You</span>
              </div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Calling {otherUsername}...</h2>
            <p className="text-white/70 animate-pulse">Waiting for answer...</p>
            
            {/* Hidden remote video ref for when call connects */}
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        ) : (
          <div className="text-center text-white">
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white text-6xl sm:text-7xl font-bold mx-auto mb-8 shadow-2xl ring-4 ring-white/30 animate-pulse">
              {otherUsername[0]?.toUpperCase() || '?'}
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{otherUsername}</h2>
            
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <span className="text-2xl">{isVideoCall ? '📹' : '📞'}</span>
              <span className="font-medium">{isVideoCall ? 'Video Call' : 'Voice Call'}</span>
            </div>
            
            <p className="text-2xl font-semibold">
              {isIncoming && (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-bounce">📲</span>
                  Incoming Call...
                </span>
              )}
              {activeCall.status === 'calling' && activeCall.is_caller && (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">📞</span>
                  Calling...
                </span>
              )}
              {activeCall.status === 'ringing' && (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-bounce">🔔</span>
                  Ringing...
                </span>
              )}
              {isConnected && formatDuration(callDuration)}
            </p>

            {mediaError && (
              <div className="mt-6 bg-red-500/20 border border-red-500/50 rounded-2xl px-6 py-4 text-red-200 max-w-md mx-auto">
                <p className="text-sm font-medium mb-2">⚠️ Media Access Error</p>
                <p className="text-xs whitespace-pre-line">{mediaError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 bg-red-500/30 hover:bg-red-500/50 text-white text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Reload Page
                </button>
              </div>
            )}

            {isConnected && !isVideoCall && (
              <>
                <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
              </>
            )}
            
            {/* For incoming video call - show local preview when answered */}
            {isVideoCall && !activeCall.is_caller && !isConnected && (
              <>
                <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
              </>
            )}
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-6 pb-10 sm:p-8">
        {isIncoming && (
          <div className="flex items-center justify-center gap-12">
            <div className="flex flex-col items-center">
              <button
                onClick={handleReject}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white text-3xl flex items-center justify-center shadow-xl shadow-red-500/40 transition-all transform hover:scale-110 active:scale-95 mb-3"
              >
                ❌
              </button>
              <span className="text-white font-bold">Decline</span>
            </div>
            
            <div className="flex flex-col items-center">
              <button
                onClick={handleAnswer}
                className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white text-3xl flex items-center justify-center shadow-xl shadow-green-500/40 transition-all transform hover:scale-110 active:scale-95 mb-3"
              >
                {isVideoCall ? '📹' : '📞'}
              </button>
              <span className="text-white font-bold">Accept</span>
            </div>
          </div>
        )}

        {(activeCall.is_caller || isConnected) && !isIncoming && (
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center">
              <button
                onClick={handleToggleMute}
                className={`w-16 h-16 rounded-full ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
                } text-2xl flex items-center justify-center backdrop-blur-sm transition-all hover:scale-105 active:scale-95 mb-2`}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <span className="text-white text-sm font-medium">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </div>

            {isVideoCall && (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleToggleVideo}
                  className={`w-16 h-16 rounded-full ${
                    isVideoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
                  } text-2xl flex items-center justify-center backdrop-blur-sm transition-all hover:scale-105 active:scale-95 mb-2`}
                >
                  {isVideoOff ? '📷' : '📹'}
                </button>
                <span className="text-white text-sm font-medium">
                  {isVideoOff ? 'Camera On' : 'Camera Off'}
                </span>
              </div>
            )}

            {/* Add People Button - only for caller */}
            {activeCall.is_caller && isConnected && (
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setShowAddPeople(true)}
                  className="w-16 h-16 rounded-full bg-cyan-500 text-white text-2xl flex items-center justify-center backdrop-blur-sm transition-all hover:scale-105 active:scale-95 mb-2"
                >
                  👥
                </button>
                <span className="text-white text-sm font-medium">Add</span>
              </div>
            )}

            <div className="flex flex-col items-center">
              <button
                onClick={handleEnd}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white text-3xl flex items-center justify-center shadow-xl shadow-red-500/40 transition-all transform hover:scale-110 active:scale-95 mb-2"
              >
                📵
              </button>
              <span className="text-white text-sm font-medium">End Call</span>
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={handleToggleSpeaker}
                className={`w-16 h-16 rounded-full ${
                  isSpeaker ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                } text-2xl flex items-center justify-center backdrop-blur-sm transition-all hover:scale-105 active:scale-95 mb-2`}
              >
                {isSpeaker ? '🔊' : '🔈'}
              </button>
              <span className="text-white text-sm font-medium">
                {isSpeaker ? 'Speaker' : 'Earpiece'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add People Modal */}
      {showAddPeople && activeCall && (
        <AddToCallModal
          isOpen={showAddPeople}
          callId={activeCall.id}
          onClose={() => setShowAddPeople(false)}
          onUserAdded={(userId) => {
            console.log('User added to call:', userId)
          }}
        />
      )}
    </div>
  )
}

import { supabase } from '@/lib/supabase/client'

// STUN/TURN servers for WebRTC connection
// Added free TURN servers for better connectivity (works behind NAT/firewalls)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // OpenRelay TURN servers (free, public)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    // Twilio STUN (free)
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10
}

export interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onError?: (error: Error) => void
  onPermissionDenied?: (type: 'camera' | 'microphone' | 'both') => void
}

// Detect iOS Safari/Chrome
function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

// Check if media permissions are granted
async function checkMediaPermissions(): Promise<{ camera: boolean; microphone: boolean }> {
  const result = { camera: false, microphone: false }
  
  try {
    // Check camera permission
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const cameraResult = await navigator.permissions.query({ name: 'camera' as PermissionName })
        result.camera = cameraResult.state === 'granted'
      } catch {
        // Safari doesn't support camera permission query
      }
      
      try {
        const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        result.microphone = micResult.state === 'granted'
      } catch {
        // Safari doesn't support microphone permission query
      }
    }
  } catch (error) {
    console.log('Permission API not supported')
  }
  
  return result
}

// Request media with iOS-specific handling
async function requestMediaWithIOSSupport(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  const isIOSDevice = isIOS()
  const isSafariBrowser = isSafari()
  
  console.log('Device info:', { isIOS: isIOSDevice, isSafari: isSafariBrowser })
  
  // For iOS, we need to be more careful with constraints
  if (isIOSDevice) {
    // iOS Safari requires simpler constraints
    const iosConstraints: MediaStreamConstraints = {
      audio: constraints.audio ? {
        echoCancellation: true,
        noiseSuppression: true,
      } : false,
      video: constraints.video ? {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      } : false
    }
    
    console.log('Using iOS constraints:', iosConstraints)
    
    try {
      return await navigator.mediaDevices.getUserMedia(iosConstraints)
    } catch (error: any) {
      console.error('iOS media error:', error.name, error.message)
      
      // If video fails on iOS, try audio only
      if (constraints.video && error.name === 'NotAllowedError') {
        console.log('Trying audio only on iOS...')
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }
      throw error
    }
  }
  
  // Standard path for non-iOS devices
  return await navigator.mediaDevices.getUserMedia(constraints)
}

// Show iOS permission help
function showIOSPermissionHelp(): string {
  if (isSafari()) {
    return 'To enable camera/microphone on iOS Safari:\n1. Go to Settings > Safari > Camera/Microphone\n2. Allow access for this website\n3. Reload the page and try again'
  } else {
    return 'To enable camera/microphone on iOS Chrome:\n1. Go to Settings > Chrome > Camera/Microphone\n2. Allow access\n3. Reload the page and try again'
  }
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private callId: string | null = null
  private callbacks: WebRTCCallbacks = {}
  private pollingInterval: NodeJS.Timeout | null = null
  private iceCandidatesQueue: RTCIceCandidateInit[] = []
  private isAnswerer: boolean = false

  async initializeCall(
    callId: string,
    callType: 'voice' | 'video',
    isCaller: boolean,
    callbacks: WebRTCCallbacks
  ): Promise<boolean> {
    this.callId = callId
    this.callbacks = callbacks
    this.isAnswerer = !isCaller

    try {
      // Check if mediaDevices is available (required for HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '[::1]')
        
        const isSecure = typeof window !== 'undefined' && 
          (window.location.protocol === 'https:' || isLocalhost)
        
        let errorMessage = 'Camera/microphone not available.'
        
        if (!isSecure) {
          errorMessage = `Camera/microphone requires HTTPS.\n\nYou are accessing via: ${window.location.protocol}//${window.location.host}\n\nTo fix this:\n1. Use ngrok: npx ngrok http 3000\n2. Then open the https:// URL on your phone`
        } else if (isIOS()) {
          errorMessage = 'Camera/microphone not available on this iOS browser. Try using Safari.'
        }
        
        callbacks.onError?.(new Error(errorMessage))
        return false
      }

      // Check existing permissions
      const permissions = await checkMediaPermissions()
      console.log('Current permissions:', permissions)

      // Get user media with iOS support
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      }

      console.log('Requesting media with constraints:', constraints)
      
      try {
        this.localStream = await requestMediaWithIOSSupport(constraints)
      } catch (mediaError: any) {
        console.error('Media access error:', mediaError.name, mediaError.message)
        
        // Handle specific permission errors
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          const isIOSDevice = isIOS()
          let errorMessage = 'Camera/microphone permission denied.'
          
          if (isIOSDevice) {
            errorMessage = showIOSPermissionHelp()
          } else {
            errorMessage = 'Please allow camera and microphone access in your browser settings, then reload the page.'
          }
          
          callbacks.onError?.(new Error(errorMessage))
          callbacks.onPermissionDenied?.(callType === 'video' ? 'both' : 'microphone')
          return false
        }
        
        if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          callbacks.onError?.(new Error('No camera or microphone found on this device.'))
          return false
        }
        
        if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          callbacks.onError?.(new Error('Camera/microphone is already in use by another app. Please close other apps and try again.'))
          return false
        }
        
        callbacks.onError?.(new Error(`Media error: ${mediaError.message}`))
        return false
      }
      
      console.log('Got local stream:', this.localStream.getTracks().map(t => t.kind))
      
      callbacks.onLocalStream?.(this.localStream)

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(ICE_SERVERS)
      
      // Add local tracks to connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log('Adding track:', track.kind)
          this.peerConnection.addTrack(track, this.localStream)
        }
      })

      // Handle remote tracks
      this.remoteStream = new MediaStream()
      
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind)
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream?.addTrack(track)
        })
        callbacks.onRemoteStream?.(this.remoteStream!)
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate.candidate.substring(0, 50))
          await this.sendIceCandidate(event.candidate)
        }
      }

      // Monitor connection state
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState)
        callbacks.onConnectionStateChange?.(this.peerConnection?.connectionState || 'closed')
        
        if (this.peerConnection?.connectionState === 'failed') {
          // Try ICE restart on failure
          this.attemptReconnect()
        }
      }

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState)
        
        // Handle ICE connection failures
        if (this.peerConnection?.iceConnectionState === 'failed') {
          console.log('ICE failed, attempting restart...')
          this.attemptReconnect()
        }
        
        // Handle disconnection
        if (this.peerConnection?.iceConnectionState === 'disconnected') {
          console.log('ICE disconnected, waiting for reconnection...')
          // Give it some time to reconnect automatically
          setTimeout(() => {
            if (this.peerConnection?.iceConnectionState === 'disconnected') {
              this.attemptReconnect()
            }
          }, 5000)
        }
      }
      
      // Log ICE gathering state
      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState)
      }

      if (isCaller) {
        // Create and send offer
        await this.createAndSendOffer()
      }

      // Start polling for signaling data
      this.startSignalingPolling()

      return true
    } catch (error) {
      console.error('WebRTC initialization error:', error)
      callbacks.onError?.(error as Error)
      return false
    }
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.callId) return

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      
      await this.peerConnection.setLocalDescription(offer)
      console.log('Created offer:', offer.type)

      // Wait briefly for initial ICE candidates to be gathered
      await new Promise(resolve => setTimeout(resolve, 500))

      // Save offer to database
      const { error } = await supabase
        .from('call_logs')
        .update({ 
          offer: {
            type: offer.type,
            sdp: offer.sdp
          }
        })
        .eq('id', this.callId)

      if (error) {
        console.error('Error saving offer:', error)
      }
    } catch (error) {
      console.error('Error creating offer:', error)
      this.callbacks.onError?.(error as Error)
    }
  }

  async handleIncomingOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return

    try {
      console.log('Setting remote description (offer)')
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))

      // Process queued ICE candidates
      for (const candidate of this.iceCandidatesQueue) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
      this.iceCandidatesQueue = []

      // Create and send answer
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      console.log('Created answer:', answer.type)

      // Save answer to database
      const { error } = await supabase
        .from('call_logs')
        .update({ 
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        })
        .eq('id', this.callId)

      if (error) {
        console.error('Error saving answer:', error)
      }
    } catch (error) {
      console.error('Error handling offer:', error)
      this.callbacks.onError?.(error as Error)
    }
  }

  async handleIncomingAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return

    try {
      console.log('Setting remote description (answer)')
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))

      // Process queued ICE candidates
      for (const candidate of this.iceCandidatesQueue) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
      this.iceCandidatesQueue = []
    } catch (error) {
      console.error('Error handling answer:', error)
      this.callbacks.onError?.(error as Error)
    }
  }

  private async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.callId) return

    try {
      // Get current ICE candidates
      const { data } = await supabase
        .from('call_logs')
        .select('ice_candidates')
        .eq('id', this.callId)
        .single()

      const existingCandidates = (data?.ice_candidates as RTCIceCandidateInit[]) || []
      
      // Add new candidate
      const newCandidate = {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        from: this.isAnswerer ? 'answerer' : 'caller'
      }

      const { error } = await supabase
        .from('call_logs')
        .update({ 
          ice_candidates: [...existingCandidates, newCandidate]
        })
        .eq('id', this.callId)

      if (error) {
        console.error('Error saving ICE candidate:', error)
      }
    } catch (error) {
      console.error('Error sending ICE candidate:', error)
    }
  }

  private processedCandidates = new Set<string>()

  private async processIceCandidates(candidates: any[]): Promise<void> {
    if (!this.peerConnection) return

    const myRole = this.isAnswerer ? 'answerer' : 'caller'
    
    for (const candidate of candidates) {
      // Only process candidates from the other party
      if (candidate.from === myRole) continue
      
      const candidateKey = candidate.candidate
      if (this.processedCandidates.has(candidateKey)) continue
      
      this.processedCandidates.add(candidateKey)

      try {
        if (this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate({
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex
          }))
          console.log('Added ICE candidate from', candidate.from)
        } else {
          // Queue candidate if remote description not set yet
          this.iceCandidatesQueue.push({
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex
          })
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    }
  }

  private hasProcessedOffer = false
  private hasProcessedAnswer = false

  private startSignalingPolling(): void {
    // Poll for signaling data every 300ms for faster connection
    this.pollingInterval = setInterval(async () => {
      if (!this.callId) return

      try {
        const { data, error } = await supabase
          .from('call_logs')
          .select('offer, answer, ice_candidates, status')
          .eq('id', this.callId)
          .single()

        if (error || !data) return

        // Check if call ended
        if (['ended', 'rejected', 'missed', 'cancelled'].includes(data.status)) {
          this.cleanup()
          return
        }

        // Process offer if we're the answerer
        if (this.isAnswerer && data.offer && !this.hasProcessedOffer) {
          this.hasProcessedOffer = true
          await this.handleIncomingOffer(data.offer as RTCSessionDescriptionInit)
        }

        // Process answer if we're the caller
        if (!this.isAnswerer && data.answer && !this.hasProcessedAnswer) {
          this.hasProcessedAnswer = true
          await this.handleIncomingAnswer(data.answer as RTCSessionDescriptionInit)
        }

        // Process ICE candidates
        if (data.ice_candidates && Array.isArray(data.ice_candidates)) {
          await this.processIceCandidates(data.ice_candidates)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 300) // Fast polling for quicker connection
  }

  toggleMute(): boolean {
    if (!this.localStream) return false
    
    const audioTrack = this.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      return !audioTrack.enabled // Return true if muted
    }
    return false
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false
    
    const videoTrack = this.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      return !videoTrack.enabled // Return true if video off
    }
    return false
  }

  toggleSpeaker(): boolean {
    // Speaker toggle would require audio output device selection
    // This is a placeholder - actual implementation depends on browser API
    return false
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.peerConnection || !this.callId) return
    
    console.log('Attempting ICE restart...')
    
    try {
      // Create new offer with ICE restart flag
      const offer = await this.peerConnection.createOffer({ 
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      
      await this.peerConnection.setLocalDescription(offer)
      
      // Save new offer to database
      const { error } = await supabase
        .from('call_logs')
        .update({ 
          offer: {
            type: offer.type,
            sdp: offer.sdp
          },
          ice_candidates: [] // Clear old candidates for fresh restart
        })
        .eq('id', this.callId)

      if (error) {
        console.error('Error saving restart offer:', error)
      } else {
        console.log('ICE restart offer sent')
        // Reset processed state for fresh signaling
        this.hasProcessedAnswer = false
        this.processedCandidates.clear()
      }
    } catch (error) {
      console.error('ICE restart failed:', error)
      this.callbacks.onError?.(new Error('Connection lost. Please try again.'))
    }
  }

  cleanup(): void {
    console.log('Cleaning up WebRTC')
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop()
        console.log('Stopped track:', track.kind)
      })
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.remoteStream = null
    this.callId = null
    this.hasProcessedOffer = false
    this.hasProcessedAnswer = false
    this.processedCandidates.clear()
    this.iceCandidatesQueue = []
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }
}

// Export singleton instance
export const webRTCService = new WebRTCService()

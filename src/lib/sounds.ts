// Audio utility for generating call sounds using Web Audio API
// This is used as a fallback when audio files are not available

export class CallSounds {
  private static audioContext: AudioContext | null = null
  private static oscillator: OscillatorNode | null = null
  private static gainNode: GainNode | null = null
  private static intervalId: NodeJS.Timeout | null = null

  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  // Play incoming call ringtone (repeating pattern)
  static playIncomingRing(): void {
    this.stop()
    
    const playTone = () => {
      try {
        const ctx = this.getAudioContext()
        if (ctx.state === 'suspended') {
          ctx.resume()
        }

        // Create oscillator for ring tone
        this.oscillator = ctx.createOscillator()
        this.gainNode = ctx.createGain()

        this.oscillator.connect(this.gainNode)
        this.gainNode.connect(ctx.destination)

        // Ring tone frequency pattern
        this.oscillator.frequency.setValueAtTime(440, ctx.currentTime)
        this.oscillator.frequency.setValueAtTime(480, ctx.currentTime + 0.2)
        this.oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.4)

        // Envelope
        this.gainNode.gain.setValueAtTime(0, ctx.currentTime)
        this.gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
        this.gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.5)
        this.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)

        this.oscillator.start(ctx.currentTime)
        this.oscillator.stop(ctx.currentTime + 0.6)
      } catch (err) {
        console.log('Could not play incoming ring:', err)
      }
    }

    // Play immediately and repeat
    playTone()
    this.intervalId = setInterval(playTone, 2000)
  }

  // Play outgoing call ringback tone
  static playOutgoingRing(): void {
    this.stop()

    const playTone = () => {
      try {
        const ctx = this.getAudioContext()
        if (ctx.state === 'suspended') {
          ctx.resume()
        }

        this.oscillator = ctx.createOscillator()
        this.gainNode = ctx.createGain()

        this.oscillator.connect(this.gainNode)
        this.gainNode.connect(ctx.destination)

        // US ringback tone (440Hz + 480Hz)
        this.oscillator.frequency.setValueAtTime(440, ctx.currentTime)

        this.gainNode.gain.setValueAtTime(0, ctx.currentTime)
        this.gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05)
        this.gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.9)
        this.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)

        this.oscillator.start(ctx.currentTime)
        this.oscillator.stop(ctx.currentTime + 2)
      } catch (err) {
        console.log('Could not play outgoing ring:', err)
      }
    }

    playTone()
    this.intervalId = setInterval(playTone, 4000)
  }

  // Play notification sound for messages
  static playMessageNotification(): void {
    try {
      const ctx = this.getAudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      // Short pleasant notification tone
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1)

      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.2)
    } catch (err) {
      console.log('Could not play notification:', err)
    }
  }

  // Play call end tone
  static playEndCall(): void {
    try {
      const ctx = this.getAudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      // Descending tone for call end
      osc.frequency.setValueAtTime(480, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(380, ctx.currentTime + 0.3)

      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch (err) {
      console.log('Could not play end call sound:', err)
    }
  }

  // Stop all sounds
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    if (this.oscillator) {
      try {
        this.oscillator.stop()
      } catch (e) {
        // Ignore - oscillator may have already stopped
      }
      this.oscillator = null
    }
    
    if (this.gainNode) {
      this.gainNode = null
    }
  }
}

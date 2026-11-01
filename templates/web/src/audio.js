// One AudioContext, resumed on the first user gesture. Failures are observable, never silent.
export class Audio {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.error = null
  }

  async unlock() {
    if (this.error) return false
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) throw new Error('Web Audio is not available in this browser')
        this.ctx = new Ctx()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.2
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return this.ctx.state === 'running'
    } catch (e) {
      this.error = e
      console.warn('audio unavailable:', e.message)
      return false
    }
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.2
  }

  /** square-wave blip, scheduled on the audio clock (not setTimeout) */
  beep(freq = 440, dur = 0.08) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }
}

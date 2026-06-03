/**
 * Dino Chrome - Sound Manager
 * Synthesizes retro 8-bit game sound effects using the Web Audio API.
 * No external files required. Runs completely offline.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    
    // Load mute preference
    const savedMute = localStorage.getItem('dino_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
  }

  /**
   * Initializes the AudioContext upon user interaction.
   * Browsers block autoplay audio until a user gesture occurs.
   */
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser:", e);
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('dino_muted', this.isMuted);
    
    // If unmuting, resume context in case it was suspended
    if (!this.isMuted && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    return this.isMuted;
  }

  /**
   * Helper to create a synthesizer node chain: Osc -> Gain -> Destination
   */
  createSynth(type = 'square', duration = 0.1) {
    if (this.isMuted || !this.ctx) return null;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    
    return { osc, gain, now };
  }

  /**
   * JUMP Sound: Quick pitch sweep upward
   */
  playJump() {
    this.init();
    const synth = this.createSynth('square', 0.15);
    if (!synth) return;

    const { osc, gain, now } = synth;
    
    // Pitch sweep: 180Hz -> 650Hz
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.12);
    
    // Volume envelope: Quick fade-out
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * DUCK/SLIDE Sound: Low frequency sliding down
   */
  playSlide() {
    this.init();
    const synth = this.createSynth('triangle', 0.1);
    if (!synth) return;

    const { osc, gain, now } = synth;

    // Pitch sweep: 150Hz -> 70Hz
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.08);

    // Volume envelope
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * MILESTONE SCORE Sound: Classic high double-beeps (like Chrome Dino!)
   */
  playScore() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // First high beep (950Hz)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(950, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Second higher beep (1180Hz) after a tiny delay
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1180, now + 0.08);
    gain2.gain.setValueAtTime(0.08, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.2);
  }

  /**
   * POWER-UP Sound: Cheerful rising arpeggio
   */
  playPowerUp() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const notes = [330, 440, 554, 659, 880]; // Major scale arpeggio (E, A, C#, E, A)
    const stepDuration = 0.06;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + (index * stepDuration));
      
      gain.gain.setValueAtTime(0.12, now + (index * stepDuration));
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index * stepDuration) + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + (index * stepDuration));
      osc.stop(now + (index * stepDuration) + 0.08);
    });
  }

  /**
   * GAME OVER Sound: Low dramatic explosion and pitch slide
   */
  playGameOver() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // 1. Low Pitch Downward Sweep
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.4);
    
    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // 2. White Noise for Explosion Crash
    try {
      const bufferSize = this.ctx.sampleRate * 0.4; // 0.4 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill buffer with random values (noise)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      // Lowpass filter to make noise sound deeper and boomier
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(20, now + 0.4);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      noiseNode.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      
      noiseNode.start(now);
      noiseNode.stop(now + 0.4);
    } catch (e) {
      console.warn("Noise buffer generation failed, falling back to oscillator only:", e);
    }
  }

  /**
   * SHOOT Sound: Quick high-to-low laser sweep
   */
  playShoot() {
    this.init();
    const synth = this.createSynth('triangle', 0.12);
    if (!synth) return;

    const { osc, gain, now } = synth;

    // Pitch sweep: 880Hz -> 220Hz
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    // Volume envelope
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * EXPLOSION Sound: White noise explosion with bandpass filter decay
   */
  playExplosion() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    try {
      const bufferSize = this.ctx.sampleRate * 0.35; // 0.35 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      noiseNode.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      
      noiseNode.start(now);
      noiseNode.stop(now + 0.35);
    } catch (e) {
      console.warn("Explosion noise buffer failed, playing oscillator fallback:", e);
      // Fallback deep beep
      const synth = this.createSynth('sawtooth', 0.2);
      if (synth) {
        const { osc, gain } = synth;
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    }
  }

  /**
   * RELOAD Sound: Rising double-beep
   */
  playReload() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // First beep: 587Hz (D5)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(587, now);
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Second beep: 880Hz (A5) after 0.05s
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(880, now + 0.05);
    gain2.gain.setValueAtTime(0.06, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.13);
  }

  /**
   * DRY FIRE Sound: Short low buzz for no ammo
   */
  playDryFire() {
    this.init();
    const synth = this.createSynth('triangle', 0.08);
    if (!synth) return;

    const { osc, gain, now } = synth;

    osc.frequency.setValueAtTime(120, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.08);
  }
}

// Global instance of SoundManager
const soundManager = new SoundManager();
window.soundManager = soundManager;

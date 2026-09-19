/**
 * Rect10 Procedural Web Audio Engine (Phase 4 Polish)
 * Zero-dependency acoustic feedback with instantaneous, low-latency synthesis.
 */

class Rect10Audio {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('rect10_muted') === 'true';
    this.lastTickTime = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('rect10_muted', this.isMuted.toString());
    return this.isMuted;
  }

  /**
   * Crisp, clearly audible tactile click/pop when selecting cells or expanding the drag box.
   * Uses a fast pitch-drop triangle wave for rich acoustic body and punch.
   */
  playDragTick() {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastTickTime < 45) return; // Debounce
    this.lastTickTime = nowMs;

    this.ensureContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Rich harmonics
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.035);

    // Punchy 0.095 gain with 2ms attack and 40ms decay
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.095, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.042);
  }

  /**
   * Crisp harmonic chime when a valid sum of 10 is cleared.
   * Modulates harmonic density based on cells cleared (2c = duo, 3c = triad, 4c+ = major 7th).
   */
  playClearChime(points = 20) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    let freqs = [523.25, 783.99]; // Default: C5, G5 (2-cell)

    if (points >= 400 || (points >= 40 && points < 100)) {
      // Rich 4-tone chord for 4+ blocks: C5, E5, G5, C6
      freqs = [523.25, 659.25, 783.99, 1046.50];
    } else if (points >= 300 || (points >= 30 && points < 100)) {
      // Triad for 3 blocks: C5, E5, G5
      freqs = [523.25, 659.25, 783.99];
    }

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.03 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.03 + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.4);
    });
  }

  /**
   * Celebratory arpeggio when a new personal best record is set.
   */
  playNewRecordFanfare() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.48);
    });
  }

  /**
   * Soft closing chime on game over.
   */
  playGameOverTone() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = [440, 392, 349.23]; // A4, G4, F4

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.42);
    });
  }

  /**
   * Subtle UI click for buttons.
   */
  playButtonTick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.02);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.028);
  }
}

if (typeof window !== 'undefined') {
  window.Rect10Audio = Rect10Audio;
}

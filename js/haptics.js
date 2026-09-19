/**
 * Rect10 Haptics Controller
 * Integrates Web Vibration API (navigator.vibrate) for mobile tactile sensations.
 * Features:
 * - Rate-limited drag ticks (avoids actuator saturation)
 * - Distinct double-pulse for sum-10 clears
 * - Celebratory multi-pulse for new records
 * - User preference persistence in localStorage
 */

class Rect10Haptics {
  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.isEnabled = this.loadPreference();
    this.lastTickTime = 0;
    this.TICK_COOLDOWN_MS = 50; // Minimum interval between drag ticks
  }

  loadPreference() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('rect10_haptics_enabled');
        if (saved !== null) {
          return saved === 'true';
        }
      }
    } catch (e) {
      console.warn('Rect10Haptics: Could not read preference', e);
    }
    return true; // Default to enabled
  }

  savePreference() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('rect10_haptics_enabled', this.isEnabled ? 'true' : 'false');
      }
    } catch (e) {
      console.warn('Rect10Haptics: Could not save preference', e);
    }
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    this.savePreference();
    if (this.isEnabled) {
      this.buttonTap();
    }
    return this.isEnabled;
  }

  vibrate(pattern) {
    if (!this.isSupported || !this.isEnabled) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Gracefully ignore user activation or security exceptions
    }
  }

  /**
   * Subtle micro-pulse when the selection box expands across a cell boundary.
   */
  dragTick() {
    const now = performance.now();
    if (now - this.lastTickTime < this.TICK_COOLDOWN_MS) return;
    this.lastTickTime = now;
    this.vibrate(8);
  }

  /**
   * Crisp double-pulse when a valid sum-10 combination is cleared.
   */
  clear() {
    this.vibrate([18, 30, 22]);
  }

  /**
   * Light tactile click for UI button interactions.
   */
  buttonTap() {
    this.vibrate(6);
  }

  /**
   * Low, soft vibration when time expires or deadlock occurs.
   */
  gameOver() {
    this.vibrate(50);
  }

  /**
   * Celebratory multi-pulse rhythm when beating a high score.
   */
  newRecord() {
    this.vibrate([30, 40, 30, 40, 60]);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Haptics };
}

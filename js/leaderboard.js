/**
 * Rect10 Leaderboard & Local Score Persistence Engine (Phase 7)
 * Supports:
 * - Multi-Tier Tracking (All-Time, Weekly ISO-week, Daily calendar date)
 * - Dynamic Grid Sizes: 'small' (7x10), 'medium' (9x12), 'large' (11x15)
 * - Game Mode Policy: Only 'challenge' mode records scores. 'free' mode bypasses recording.
 * - Run History ledger (last 10 completed games per size)
 * - Backward-compatible migration from legacy schemas
 */

class Rect10Leaderboard {
  constructor(storageKey = 'rect10_leaderboard_v1') {
    this.storageKey = storageKey;
    this.data = this.loadData();
  }

  static pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  static getISODateKey(d = new Date()) {
    return `${d.getFullYear()}-${Rect10Leaderboard.pad(d.getMonth() + 1)}-${Rect10Leaderboard.pad(d.getDate())}`;
  }

  static getISOWeekKey(d = new Date()) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7; // Monday is 0, Sunday is 6
    target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
    const firstThursday = target.valueOf();
    
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `${new Date(firstThursday).getFullYear()}-W${Rect10Leaderboard.pad(weekNumber)}`;
  }

  createEmptySizeData() {
    return {
      allTime: 0,
      daily: {},
      weekly: {},
      history: []
    };
  }

  loadData() {
    const defaultData = {
      sizes: {
        small: this.createEmptySizeData(),
        medium: this.createEmptySizeData(),
        large: this.createEmptySizeData()
      }
    };

    try {
      if (typeof localStorage === 'undefined') return defaultData;

      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sizes) {
          // Schema with sizes already present
          return {
            sizes: {
              small: parsed.sizes.small || this.createEmptySizeData(),
              medium: parsed.sizes.medium || this.createEmptySizeData(),
              large: parsed.sizes.large || this.createEmptySizeData()
            }
          };
        } else if (typeof parsed.allTime === 'number') {
          // Migration from Phase 5 single-size schema (which was large 11x15)
          defaultData.sizes.large = {
            allTime: parsed.allTime || 0,
            daily: parsed.daily || {},
            weekly: parsed.weekly || {},
            history: Array.isArray(parsed.history) ? parsed.history : []
          };
          this.saveData(defaultData);
          return defaultData;
        }
      }

      // Check legacy single-scalar score for backward compatibility
      const legacyScore = localStorage.getItem('rect10_high_score');
      if (legacyScore) {
        const parsedLegacy = parseInt(legacyScore, 10);
        if (!isNaN(parsedLegacy) && parsedLegacy > 0) {
          defaultData.sizes.large.allTime = parsedLegacy;
          this.saveData(defaultData);
        }
      }
    } catch (e) {
      console.warn('Rect10Leaderboard: Unable to load localStorage data:', e);
    }

    return defaultData;
  }

  saveData(data = this.data) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      // Keep legacy scalar in sync for backward compatibility
      const maxScore = Math.max(
        data.sizes.small.allTime || 0,
        data.sizes.medium.allTime || 0,
        data.sizes.large.allTime || 0
      );
      localStorage.setItem('rect10_high_score', maxScore.toString());
    } catch (e) {
      console.warn('Rect10Leaderboard: Unable to save to localStorage:', e);
    }
  }

  getSizeBucket(size = 'large') {
    const key = (size || 'large').toLowerCase();
    if (!this.data.sizes[key]) {
      this.data.sizes[key] = this.createEmptySizeData();
    }
    return this.data.sizes[key];
  }

  getTodayBest(size = 'large', date = new Date()) {
    const bucket = this.getSizeBucket(size);
    const key = Rect10Leaderboard.getISODateKey(date);
    return bucket.daily[key] || 0;
  }

  getWeeklyBest(size = 'large', date = new Date()) {
    const bucket = this.getSizeBucket(size);
    const key = Rect10Leaderboard.getISOWeekKey(date);
    return bucket.weekly[key] || 0;
  }

  getAllTimeBest(size = 'large') {
    const bucket = this.getSizeBucket(size);
    return bucket.allTime || 0;
  }

  getHistory(size = 'large') {
    const bucket = this.getSizeBucket(size);
    return bucket.history || [];
  }

  /**
   * Records a completed round score.
   * Free Mode explicitly bypasses recording.
   * @param {number} score
   * @param {Object} details - { mode, size, rank, clearsCount, cellsClearedTotal, largestClear, paceCPM }
   * @param {Date} [now]
   * @returns {Object} Milestone flags { isNewAllTime, isNewWeekly, isNewDaily, allTime, weekly, daily, isFreeMode }
   */
  recordScore(score, details = {}, now = new Date()) {
    const size = (details.size || 'large').toLowerCase();
    const mode = (details.mode || 'challenge').toLowerCase();
    const bucket = this.getSizeBucket(size);

    // Free Mode does NOT log scores to leaderboards
    if (mode === 'free') {
      return {
        isNewAllTime: false,
        isNewWeekly: false,
        isNewDaily: false,
        allTime: this.getAllTimeBest(size),
        weekly: this.getWeeklyBest(size, now),
        daily: this.getTodayBest(size, now),
        isFreeMode: true
      };
    }

    const numScore = Math.max(0, Math.floor(score || 0));
    const dayKey = Rect10Leaderboard.getISODateKey(now);
    const weekKey = Rect10Leaderboard.getISOWeekKey(now);

    const prevAllTime = this.getAllTimeBest(size);
    const prevWeekly = this.getWeeklyBest(size, now);
    const prevDaily = this.getTodayBest(size, now);

    const isNewAllTime = numScore > prevAllTime;
    const isNewWeekly = numScore > prevWeekly;
    const isNewDaily = numScore > prevDaily;

    if (isNewAllTime) {
      bucket.allTime = numScore;
    }

    if (isNewWeekly) {
      bucket.weekly[weekKey] = numScore;
    }

    if (isNewDaily) {
      bucket.daily[dayKey] = numScore;
    }

    // Record into history ledger (capped at last 10 entries per size)
    const runRecord = {
      id: `run_${Date.now()}`,
      timestamp: now.toISOString(),
      score: numScore,
      mode: 'challenge',
      size: size,
      rank: details.rank || 'Novice',
      clears: details.clearsCount || 0,
      cells: details.cellsClearedTotal || 0,
      largestClear: details.largestClear || 0,
      pace: details.paceCPM || '0.0',
      durationSec: typeof details.durationSec === 'number' ? details.durationSec : null,
      lastClearSec: typeof details.lastClearSec === 'number' ? details.lastClearSec : null,
      lastClearFormatted: details.lastClearFormatted || null
    };

    bucket.history.unshift(runRecord);
    if (bucket.history.length > 10) {
      bucket.history = bucket.history.slice(0, 10);
    }

    // Clean up daily records older than 60 days to prevent bloat
    this.pruneOldRecords(bucket, now);

    this.saveData();

    return {
      isNewAllTime,
      isNewWeekly,
      isNewDaily,
      allTime: this.getAllTimeBest(size),
      weekly: this.getWeeklyBest(size, now),
      daily: this.getTodayBest(size, now),
      isFreeMode: false
    };
  }

  pruneOldRecords(bucket, now = new Date()) {
    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const cutoffDay = Rect10Leaderboard.getISODateKey(cutoff);

    for (const key of Object.keys(bucket.daily)) {
      if (key < cutoffDay) {
        delete bucket.daily[key];
      }
    }
  }

  clearAll() {
    this.data = {
      sizes: {
        small: this.createEmptySizeData(),
        medium: this.createEmptySizeData(),
        large: this.createEmptySizeData()
      }
    };
    this.saveData();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Leaderboard };
}

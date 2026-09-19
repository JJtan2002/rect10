/**
 * Rect10 Leaderboard & Local Score Persistence Engine
 * Supports:
 * - All-Time High Score
 * - Weekly Best (partitioned by ISO week e.g. 2026-W38, resets Mondays)
 * - Daily Best (partitioned by local calendar date YYYY-MM-DD, resets at midnight)
 * - Recent Run History ledger (last 10 completed games)
 * - Legacy migration from rect10_high_score
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

  loadData() {
    const defaultData = {
      allTime: 0,
      daily: {},
      weekly: {},
      history: []
    };

    try {
      if (typeof localStorage === 'undefined') return defaultData;

      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          allTime: typeof parsed.allTime === 'number' ? parsed.allTime : 0,
          daily: typeof parsed.daily === 'object' && parsed.daily ? parsed.daily : {},
          weekly: typeof parsed.weekly === 'object' && parsed.weekly ? parsed.weekly : {},
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }

      // Check legacy single-scalar score for backward compatibility
      const legacyScore = localStorage.getItem('rect10_high_score');
      if (legacyScore) {
        const parsedLegacy = parseInt(legacyScore, 10);
        if (!isNaN(parsedLegacy) && parsedLegacy > 0) {
          defaultData.allTime = parsedLegacy;
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
      localStorage.setItem('rect10_high_score', (data.allTime || 0).toString());
    } catch (e) {
      console.warn('Rect10Leaderboard: Unable to save to localStorage:', e);
    }
  }

  getTodayBest(date = new Date()) {
    const key = Rect10Leaderboard.getISODateKey(date);
    return this.data.daily[key] || 0;
  }

  getWeeklyBest(date = new Date()) {
    const key = Rect10Leaderboard.getISOWeekKey(date);
    return this.data.weekly[key] || 0;
  }

  getAllTimeBest() {
    return this.data.allTime || 0;
  }

  getHistory() {
    return this.data.history || [];
  }

  /**
   * Records a completed round score and updates daily/weekly/all-time milestones.
   * @param {number} score
   * @param {Object} details - { rank, clearsCount, cellsClearedTotal, largestClear, paceCPM, clearBreakdown }
   * @param {Date} [now]
   * @returns {Object} Milestone flags { isNewAllTime, isNewWeekly, isNewDaily, allTime, weekly, daily }
   */
  recordScore(score, details = {}, now = new Date()) {
    const numScore = Math.max(0, Math.floor(score || 0));
    const dayKey = Rect10Leaderboard.getISODateKey(now);
    const weekKey = Rect10Leaderboard.getISOWeekKey(now);

    const prevAllTime = this.getAllTimeBest();
    const prevWeekly = this.getWeeklyBest(now);
    const prevDaily = this.getTodayBest(now);

    const isNewAllTime = numScore > prevAllTime;
    const isNewWeekly = numScore > prevWeekly;
    const isNewDaily = numScore > prevDaily;

    if (isNewAllTime) {
      this.data.allTime = numScore;
    }

    if (isNewWeekly) {
      this.data.weekly[weekKey] = numScore;
    }

    if (isNewDaily) {
      this.data.daily[dayKey] = numScore;
    }

    // Record into history ledger (capped at last 10 entries)
    const runRecord = {
      id: `run_${Date.now()}`,
      timestamp: now.toISOString(),
      score: numScore,
      rank: details.rank || 'Novice',
      clears: details.clearsCount || 0,
      cells: details.cellsClearedTotal || 0,
      largestClear: details.largestClear || 0,
      pace: details.paceCPM || '0.0'
    };

    this.data.history.unshift(runRecord);
    if (this.data.history.length > 10) {
      this.data.history = this.data.history.slice(0, 10);
    }

    // Clean up daily/weekly records older than 60 days to prevent bloat
    this.pruneOldRecords(now);

    this.saveData();

    return {
      isNewAllTime,
      isNewWeekly,
      isNewDaily,
      allTime: this.getAllTimeBest(),
      weekly: this.getWeeklyBest(now),
      daily: this.getTodayBest(now)
    };
  }

  pruneOldRecords(now = new Date()) {
    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const cutoffDay = Rect10Leaderboard.getISODateKey(cutoff);

    for (const key of Object.keys(this.data.daily)) {
      if (key < cutoffDay) {
        delete this.data.daily[key];
      }
    }
  }

  clearAll() {
    this.data = {
      allTime: 0,
      daily: {},
      weekly: {},
      history: []
    };
    this.saveData();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Leaderboard };
}

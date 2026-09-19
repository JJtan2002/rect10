/**
 * Rect10 Missions & Career Progression System (Phase 7+)
 * 
 * Tracks cumulative career score across finished Challenge Mode rounds and unlocks
 * tactical skills at milestone thresholds:
 * - Clairvoyance (100k): Highlights 1 valid sum-10 match.
 * - Gravity (200k): Drops active blocks flush to the bottom.
 * - Reset (300k): Re-rolls remaining blocks with fresh digits.
 */

const CAREER_STORAGE_KEY = 'rect10_career_v1';

const SKILL_DEFINITIONS = {
  clairvoyance: {
    id: 'clairvoyance',
    name: 'Clairvoyance',
    icon: '👁️',
    requiredScore: 100000,
    tagline: 'Reveal Match',
    description: 'Scans the board and highlights one valid sum-10 rectangle.'
  },
  gravity: {
    id: 'gravity',
    name: 'Gravity',
    icon: '⬇️',
    requiredScore: 200000,
    tagline: 'Drop Blocks',
    description: 'Collapses all active numbers flush to the bottom of their columns.'
  },
  reset: {
    id: 'reset',
    name: 'Reset',
    icon: '🎲',
    requiredScore: 300000,
    tagline: 'Re-roll Board',
    description: 'Replaces remaining numbers with fresh digits to break deadlocks.'
  }
};

class Rect10Missions {
  constructor(storageKey = CAREER_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (typeof localStorage === 'undefined') {
        return { careerScore: 0, skillsUnlocked: [], gamesCompleted: 0 };
      }
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return { careerScore: 0, skillsUnlocked: [], gamesCompleted: 0 };
      }
      const parsed = JSON.parse(raw);
      return {
        careerScore: typeof parsed.careerScore === 'number' ? parsed.careerScore : 0,
        skillsUnlocked: Array.isArray(parsed.skillsUnlocked) ? parsed.skillsUnlocked : [],
        gamesCompleted: typeof parsed.gamesCompleted === 'number' ? parsed.gamesCompleted : 0
      };
    } catch {
      return { careerScore: 0, skillsUnlocked: [], gamesCompleted: 0 };
    }
  }

  saveData() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      }
    } catch (e) {
      console.warn('Rect10Missions: Failed to save to localStorage', e);
    }
  }

  getCareerScore() {
    return this.data.careerScore;
  }

  getGamesCompleted() {
    return this.data.gamesCompleted;
  }

  isUnlocked(skillId) {
    return this.data.skillsUnlocked.includes(skillId);
  }

  /**
   * Adds score from a completed Challenge Mode round.
   * Checks for any newly crossed skill milestones and persists data.
   * @param {number} points 
   * @returns {{ careerScore: number, newlyUnlocked: Array<object> }}
   */
  addCareerScore(points) {
    if (typeof points !== 'number' || points <= 0) {
      return { careerScore: this.data.careerScore, newlyUnlocked: [] };
    }

    this.data.careerScore += points;
    this.data.gamesCompleted += 1;

    const newlyUnlocked = [];

    Object.values(SKILL_DEFINITIONS).forEach((def) => {
      if (!this.data.skillsUnlocked.includes(def.id) && this.data.careerScore >= def.requiredScore) {
        this.data.skillsUnlocked.push(def.id);
        newlyUnlocked.push(def);
      }
    });

    this.saveData();

    return {
      careerScore: this.data.careerScore,
      newlyUnlocked
    };
  }

  /**
   * Retrieves progression status for all skills.
   */
  getSkillsProgress() {
    const score = this.data.careerScore;
    return Object.values(SKILL_DEFINITIONS).map((def) => {
      const isUnlocked = this.data.skillsUnlocked.includes(def.id) || score >= def.requiredScore;
      const pct = Math.min(100, Math.floor((score / def.requiredScore) * 100));
      return {
        ...def,
        isUnlocked,
        currentScore: score,
        pct
      };
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Missions, SKILL_DEFINITIONS, CAREER_STORAGE_KEY };
}

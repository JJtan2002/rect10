/**
 * Automated Unit Test Suite for Rect10Leaderboard
 */

const assert = require('assert');

// Mock localStorage for Node environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockLocalStorage();

const { Rect10Leaderboard } = require('../js/leaderboard.js');

console.log('=== TEST SUITE: Rect10Leaderboard Multi-Tier System ===\n');

// 1. ISO Date & Week Key Calculation
const testDate = new Date('2026-09-19T10:00:00Z');
const dayKey = Rect10Leaderboard.getISODateKey(testDate);
assert.strictEqual(dayKey, '2026-09-19', 'Day key should match YYYY-MM-DD');
console.log('✅ PASS: getISODateKey produces correct "2026-09-19"');

const weekKey = Rect10Leaderboard.getISOWeekKey(testDate);
// 2026-09-19 is a Saturday in Week 38 of 2026
assert.strictEqual(weekKey, '2026-W38', 'Week key should match 2026-W38');
console.log('✅ PASS: getISOWeekKey produces correct "2026-W38"');

// 2. Legacy Migration Test
global.localStorage.clear();
global.localStorage.setItem('rect10_high_score', '350');
const lb1 = new Rect10Leaderboard('test_lb');
assert.strictEqual(lb1.getAllTimeBest('large'), 350, 'Legacy high score 350 should be migrated to large allTime');
console.log('✅ PASS: Legacy high score automatically migrated');

// 3. New Record Detection on First Run
const now1 = new Date('2026-09-19T12:00:00Z');
const res1 = lb1.recordScore(400, {
  size: 'large',
  mode: 'challenge',
  rank: 'Tactician',
  clearsCount: 15,
  lastClearSec: 88.4,
  lastClearFormatted: '01:28',
  durationSec: 100
}, now1);
assert.strictEqual(res1.isNewAllTime, true, '400 should be a new all-time record over 350');
assert.strictEqual(res1.isNewWeekly, true, '400 should be a new weekly best');
assert.strictEqual(res1.isNewDaily, true, '400 should be a new daily best');
assert.strictEqual(lb1.getAllTimeBest('large'), 400);
assert.strictEqual(lb1.getWeeklyBest('large', now1), 400);
assert.strictEqual(lb1.getTodayBest('large', now1), 400);
const run1 = lb1.getHistory('large')[0];
assert.strictEqual(run1.lastClearFormatted, '01:28');
assert.strictEqual(run1.lastClearSec, 88.4);
assert.strictEqual(run1.durationSec, 100);
console.log('✅ PASS: Record milestone flags and last clear timestamps set correctly');

// 4. Lower Score on Same Day
const res2 = lb1.recordScore(250, { size: 'large', mode: 'challenge', rank: 'Calculator' }, now1);
assert.strictEqual(res2.isNewAllTime, false, '250 should not beat 400 all-time');
assert.strictEqual(res2.isNewWeekly, false, '250 should not beat 400 weekly');
assert.strictEqual(res2.isNewDaily, false, '250 should not beat 400 daily');
assert.strictEqual(lb1.getAllTimeBest('large'), 400);
assert.strictEqual(lb1.getTodayBest('large', now1), 400);
console.log('✅ PASS: Lower score correctly does not override records');

// 5. Day Rollover Test (Tomorrow: 2026-09-20, Sunday)
const tomorrow = new Date('2026-09-20T08:00:00Z');
assert.strictEqual(lb1.getTodayBest('large', tomorrow), 0, 'Tomorrow starts with 0 daily best');
assert.strictEqual(lb1.getWeeklyBest('large', tomorrow), 400, 'Sunday is same ISO week (W38), so weekly best remains 400');
const resTomorrow = lb1.recordScore(300, { size: 'large', mode: 'challenge', rank: 'Calculator' }, tomorrow);
assert.strictEqual(resTomorrow.isNewDaily, true, '300 should be a new daily best for tomorrow');
assert.strictEqual(resTomorrow.isNewWeekly, false, '300 should not beat 400 weekly');
assert.strictEqual(resTomorrow.isNewAllTime, false, '300 should not beat 400 all-time');
console.log('✅ PASS: Daily rollover isolates day best while preserving weekly and all-time');

// 6. Week Rollover Test (Next Monday: 2026-09-21)
const nextMonday = new Date('2026-09-21T08:00:00Z');
assert.strictEqual(lb1.getTodayBest('large', nextMonday), 0, 'Next Monday starts with 0 daily best');
assert.strictEqual(lb1.getWeeklyBest('large', nextMonday), 0, 'Next Monday is Week 39, resets weekly best to 0');
assert.strictEqual(lb1.getAllTimeBest('large'), 400, 'All-time best remains 400');
const resNextWeek = lb1.recordScore(320, { size: 'large', mode: 'challenge', rank: 'Calculator' }, nextMonday);
assert.strictEqual(resNextWeek.isNewDaily, true, '320 is new daily for Monday');
assert.strictEqual(resNextWeek.isNewWeekly, true, '320 is new weekly for W39');
assert.strictEqual(resNextWeek.isNewAllTime, false, '320 is not new all-time');
console.log('✅ PASS: Weekly rollover resets weekly best to 0 on new ISO week');

// 7. History Ledger Capping Test
for (let i = 1; i <= 15; i++) {
  lb1.recordScore(100 + i, { size: 'large', mode: 'challenge', rank: 'Novice' }, nextMonday);
}
const history = lb1.getHistory('large');
assert.strictEqual(history.length, 10, 'History should be capped at 10 runs');
assert.strictEqual(history[0].score, 115, 'Most recent run should be at index 0');
console.log('✅ PASS: History capped at exactly 10 most recent entries');

// 8. Grid Size Partitioning Test (Small vs Medium vs Large)
lb1.recordScore(180, { size: 'small', mode: 'challenge', rank: 'Novice' }, nextMonday);
assert.strictEqual(lb1.getAllTimeBest('small'), 180, 'Small size gets its own record');
assert.strictEqual(lb1.getAllTimeBest('large'), 400, 'Large size record remains 400');
assert.strictEqual(lb1.getAllTimeBest('medium'), 0, 'Medium size record starts at 0');
console.log('✅ PASS: Grid sizes are strictly partitioned');

// 9. Free Mode Guard Test (Zero recording in Free Mode)
const freeRes = lb1.recordScore(999, { size: 'small', mode: 'free', rank: 'Grandmaster' }, nextMonday);
assert.strictEqual(freeRes.isFreeMode, true, 'Returns isFreeMode: true');
assert.strictEqual(freeRes.isNewAllTime, false, 'Free mode score does NOT trigger new all-time');
assert.strictEqual(lb1.getAllTimeBest('small'), 180, 'Small record unchanged at 180 (999 ignored)');
assert.strictEqual(lb1.getHistory('small').length, 1, 'Free mode run NOT added to history');
console.log('✅ PASS: Free mode strictly bypasses all score tracking and leaderboards');

console.log('\n🎉 ALL LEADERBOARD TESTS PASSED SUCCESSFULLY!');

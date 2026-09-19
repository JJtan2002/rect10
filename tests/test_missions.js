const assert = require('assert');
const { Rect10Missions, SKILL_DEFINITIONS } = require('../js/missions.js');

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = val.toString(); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

console.log('=== TEST SUITE: Rect10Missions System ===\n');

const missions = new Rect10Missions('test_career');
assert.strictEqual(missions.getCareerScore(), 0, 'Initial career score should be 0');
assert.strictEqual(missions.isUnlocked('clairvoyance'), false, 'Clairvoyance initially locked');
assert.strictEqual(missions.isUnlocked('gravity'), false, 'Gravity initially locked');
assert.strictEqual(missions.isUnlocked('reset'), false, 'Reset initially locked');
console.log('✅ PASS: Initial locked state');

// 1. Earn 45,000 pts (under 100k)
const res1 = missions.addCareerScore(45000);
assert.strictEqual(res1.careerScore, 45000);
assert.strictEqual(res1.newlyUnlocked.length, 0);
assert.strictEqual(missions.isUnlocked('clairvoyance'), false);
console.log('✅ PASS: Partial progress without premature unlock');

// 2. Cross 100k -> Clairvoyance unlocks
const res2 = missions.addCareerScore(60000); // 45k + 60k = 105k
assert.strictEqual(res2.careerScore, 105000);
assert.strictEqual(res2.newlyUnlocked.length, 1);
assert.strictEqual(res2.newlyUnlocked[0].id, 'clairvoyance');
assert.strictEqual(missions.isUnlocked('clairvoyance'), true);
assert.strictEqual(missions.isUnlocked('gravity'), false);
console.log('✅ PASS: Clairvoyance unlocks at 100k threshold');

// 3. Cross 200k -> Gravity unlocks
const res3 = missions.addCareerScore(100000); // 105k + 100k = 205k
assert.strictEqual(res3.newlyUnlocked.length, 1);
assert.strictEqual(res3.newlyUnlocked[0].id, 'gravity');
assert.strictEqual(missions.isUnlocked('gravity'), true);
assert.strictEqual(missions.isUnlocked('reset'), false);
console.log('✅ PASS: Gravity unlocks at 200k threshold');

// 4. Cross 300k -> Reset unlocks
const res4 = missions.addCareerScore(100000); // 205k + 100k = 305k
assert.strictEqual(res4.newlyUnlocked.length, 1);
assert.strictEqual(res4.newlyUnlocked[0].id, 'reset');
assert.strictEqual(missions.isUnlocked('reset'), true);
console.log('✅ PASS: Reset unlocks at 300k threshold');

// 5. Persistence reload
const reloaded = new Rect10Missions('test_career');
assert.strictEqual(reloaded.getCareerScore(), 305000);
assert.strictEqual(reloaded.isUnlocked('clairvoyance'), true);
assert.strictEqual(reloaded.isUnlocked('gravity'), true);
assert.strictEqual(reloaded.isUnlocked('reset'), true);
console.log('✅ PASS: Career score and skills persist across instances');

const progress = reloaded.getSkillsProgress();
assert.strictEqual(progress.length, 3);
assert.strictEqual(progress[0].isUnlocked, true);
assert.strictEqual(progress[0].pct, 100);
console.log('✅ PASS: Skills progress structure verified');

console.log('\n🎉 ALL MISSIONS TESTS PASSED SUCCESSFULLY!\n');

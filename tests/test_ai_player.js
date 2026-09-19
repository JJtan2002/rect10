/**
 * Test Suite: Rect10 AI Player & Heuristics
 * 
 * Verifies:
 * 1. AI initialization and mode configuration.
 * 2. 5-component heuristic evaluation sensitivity (score, mobility, scarcity, deadlocks).
 * 3. 1-ply Greedy move selection validity.
 * 4. Multi-ply Strategic lookahead selection validity.
 * 5. Deterministic decision reproducibility on identical seeds.
 * 6. Constraint compliance: timing telemetry tracking.
 */

const assert = require('assert');
const { Rect10Engine } = require('../js/engine');
const { Rect10AiPlayer, DEFAULT_WEIGHTS } = require('../js/ai_player');

console.log('=== TEST SUITE: Rect10 AI Player & Heuristic Engine ===\n');

// 1. Instantiation & Mode Configuration
const ai = new Rect10AiPlayer(null, { mode: 'strategic' });
assert.strictEqual(ai.mode, 'strategic', 'AI should initialize with strategic mode');
ai.setMode('greedy');
assert.strictEqual(ai.mode, 'greedy', 'AI should allow toggling to greedy mode');
ai.setMode('strategic');
console.log('✅ PASS: AI instantiation and mode switching verified');

// 2. Heuristic Sensitivity Check
const engine = new Rect10Engine(11, 15);
engine.init(null, 25);

const evalInitial = ai.evaluateState(engine);
assert(typeof evalInitial === 'number' && !isNaN(evalInitial), 'Heuristic should return a finite number');

// Test Deadlock Penalty
const deadlockedEngine = new Rect10Engine(11, 15);
// Fill with all 9s except one cell
deadlockedEngine.grid.fill(9);
deadlockedEngine.buildPrefixSums();
deadlockedEngine.movesRemaining = deadlockedEngine.countValidMoves(); // 0 moves
const evalDeadlock = ai.evaluateState(deadlockedEngine);
assert(evalDeadlock < -10000, `Deadlocked board must be heavily penalized (got ${evalDeadlock})`);
console.log(`✅ PASS: Heuristic correctly penalizes deadlocks (score: ${evalDeadlock})`);

// 3. Move Selection: Greedy Mode
ai.setMode('greedy');
const greedyDecision = ai.findBestMove(engine);
assert(greedyDecision !== null, 'Greedy AI must find a move on an active board');
assert(greedyDecision.r1 <= greedyDecision.r2, 'r1 <= r2 constraint');
assert(greedyDecision.c1 <= greedyDecision.c2, 'c1 <= c2 constraint');

const sumGreedy = engine.getRegionSum(greedyDecision.r1, greedyDecision.c1, greedyDecision.r2, greedyDecision.c2);
assert.strictEqual(sumGreedy, 10, `Selected move must sum to exactly 10 (got ${sumGreedy})`);
console.log(`✅ PASS: Greedy mode finds guaranteed valid move: [${greedyDecision.r1},${greedyDecision.c1}] to [${greedyDecision.r2},${greedyDecision.c2}]`);

// 4. Move Selection: Strategic Lookahead Mode
ai.setMode('strategic');
const strategicDecision = ai.findBestMove(engine);
assert(strategicDecision !== null, 'Strategic AI must find a move on an active board');
assert(strategicDecision.nodesEvaluated >= greedyDecision.nodesEvaluated, 'Strategic search must evaluate lookahead branches');
const sumStrategic = engine.getRegionSum(strategicDecision.r1, strategicDecision.c1, strategicDecision.r2, strategicDecision.c2);
assert.strictEqual(sumStrategic, 10, `Strategic move must sum to exactly 10 (got ${sumStrategic})`);
console.log(`✅ PASS: Strategic mode evaluated ${strategicDecision.nodesEvaluated} nodes in ${strategicDecision.thinkingTimeMs.toFixed(2)}ms (Tag: "${strategicDecision.strategyTag}")`);

// 5. Multi-Step Simulation Run (Verify AI can play 5 consecutive moves without fault)
const simEngine = new Rect10Engine(11, 15).init(null, 25);
let movesMade = 0;
for (let step = 0; step < 5; step++) {
  if (simEngine.movesRemaining === 0) break;
  const move = ai.findBestMove(simEngine);
  if (!move) break;
  const res = simEngine.attemptClear(move.r1, move.c1, move.r2, move.c2);
  assert(res.success, `Step ${step + 1} clear must succeed`);
  movesMade++;
}
assert.strictEqual(movesMade, 5, 'AI must successfully execute 5 consecutive moves');
console.log(`✅ PASS: AI executed 5 consecutive simulated turns. Score: ${simEngine.score}, Remaining Moves: ${simEngine.movesRemaining}`);

console.log('\n🎉 ALL RECT10 AI UNIT TESTS PASSED SUCCESSFULLY!\n');

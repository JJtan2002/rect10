const assert = require('assert');
const { Rect10Engine } = require('../js/engine.js');

console.log('=== TEST SUITE: Engine Skills (Clairvoyance, Gravity, Reset) ===\n');

// 1. Test getHintMove()
{
  const engine = new Rect10Engine(11, 15);
  engine.init();
  const hint = engine.getHintMove();
  assert(hint !== null, 'Hint should find at least one valid move on initial board');
  const sum = engine.getRegionSum(hint.r1, hint.c1, hint.r2, hint.c2);
  assert.strictEqual(sum, 10, 'Hint region must sum to exactly 10');
  console.log('✅ PASS: getHintMove() returns guaranteed valid sum-10 move');
}

// 2. Test applyGravity()
{
  const engine = new Rect10Engine(3, 4);
  const customGrid = new Uint8Array(12);
  // Column 0: [3, 0, 7, 0] -> should become [0, 0, 3, 7]
  customGrid[0 * 3 + 0] = 3;
  customGrid[1 * 3 + 0] = 0;
  customGrid[2 * 3 + 0] = 7;
  customGrid[3 * 3 + 0] = 0;

  // Column 1: [5, 5, 0, 0] -> should become [0, 0, 5, 5]
  customGrid[0 * 3 + 1] = 5;
  customGrid[1 * 3 + 1] = 5;
  customGrid[2 * 3 + 1] = 0;
  customGrid[3 * 3 + 1] = 0;

  engine.init(customGrid, 0);
  const gravRes = engine.applyGravity();
  assert.strictEqual(gravRes.changed, true, 'Gravity should shift tiles downward');

  // Verify Column 0
  assert.strictEqual(engine.getCellValue(0, 0), 0);
  assert.strictEqual(engine.getCellValue(1, 0), 0);
  assert.strictEqual(engine.getCellValue(2, 0), 3);
  assert.strictEqual(engine.getCellValue(3, 0), 7);

  // Verify Column 1
  assert.strictEqual(engine.getCellValue(0, 1), 0);
  assert.strictEqual(engine.getCellValue(1, 1), 0);
  assert.strictEqual(engine.getCellValue(2, 1), 5);
  assert.strictEqual(engine.getCellValue(3, 1), 5);

  // Verify prefix sums re-built properly: [2,0] to [3,0] sum is 3+7=10
  assert.strictEqual(engine.getRegionSum(2, 0, 3, 0), 10);
  console.log('✅ PASS: applyGravity() flushes numbers downward and zeroes upper slots');
}

// 3. Test applyReset()
{
  const engine = new Rect10Engine(7, 10);
  engine.init();
  
  // Clear a couple blocks so there are some 0s
  const hint = engine.getHintMove();
  engine.attemptClear(hint.r1, hint.c1, hint.r2, hint.c2);

  const zeroesBefore = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 7; c++) {
      if (engine.getCellValue(r, c) === 0) zeroesBefore.push({ r, c });
    }
  }
  assert(zeroesBefore.length > 0, 'Should have empty 0 cells');

  const resetRes = engine.applyReset();
  assert(resetRes.activeCells > 0, 'Reset should touch active cells');
  assert(resetRes.movesRemaining > 0, 'Reset should ensure valid moves exist');

  // Verify 0 cells remain 0 (player progress preserved)
  zeroesBefore.forEach(pos => {
    assert.strictEqual(engine.getCellValue(pos.r, pos.c), 0, 'Cleared zeros must remain 0 after reset');
  });

  console.log('✅ PASS: applyReset() re-rolls remaining numbers and guarantees valid moves');
}

console.log('\n🎉 ALL ENGINE SKILL TESTS PASSED SUCCESSFULLY!\n');

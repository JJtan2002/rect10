/**
 * Rect10 Engine Verification Suite & Benchmarks (11x15 Portrait Layout)
 */

const { Rect10Engine, DEFAULT_COLS, DEFAULT_ROWS } = require('../js/engine');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('=== TEST SUITE: Rect10 Engine (11x15 Portrait Layout) ===\n');

// Test 1: Initialization & Grid Dimension
{
  const engine = new Rect10Engine(11, 15);
  engine.init(null, 20);

  assert(engine.grid.length === 165, `Grid has 165 cells (11x15) (got ${engine.grid.length})`);
  assert(engine.COLS === 11 && engine.ROWS === 15, 'Engine parameters: COLS=11, ROWS=15');
  assert(engine.movesRemaining >= 20, `Initial board has >= 20 valid moves (got ${engine.movesRemaining})`);

  let validRange = true;
  for (let i = 0; i < engine.CELL_COUNT; i++) {
    if (engine.grid[i] < 1 || engine.grid[i] > 9) {
      validRange = false;
      break;
    }
  }
  assert(validRange, 'All cells contain digits between 1 and 9');
}

// Test 2: Prefix Sum O(1) Accuracy on 11x15 Matrix
{
  const engine = new Rect10Engine(11, 15);
  engine.init();

  let prefixMatch = true;
  for (let trial = 0; trial < 1000; trial++) {
    const r1 = Math.floor(Math.random() * 15);
    const r2 = Math.floor(Math.random() * 15);
    const c1 = Math.floor(Math.random() * 11);
    const c2 = Math.floor(Math.random() * 11);

    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    let manualSum = 0;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        manualSum += engine.grid[r * 11 + c];
      }
    }

    const fastSum = engine.getRectangleSum(r1, c1, r2, c2);
    if (manualSum !== fastSum) {
      prefixMatch = false;
      console.error(`Mismatch at [${minR},${minC}] to [${maxR},${maxC}]: Manual=${manualSum}, Fast=${fastSum}`);
      break;
    }
  }
  assert(prefixMatch, 'Prefix Sum queries match manual double-loop sum across 1,000 random subgrids on 11x15');
}

// Test 3: Clear Resolution & Breakdown
{
  const engine = new Rect10Engine(11, 15);
  const customGrid = new Uint8Array(165);
  customGrid.fill(9);

  // Slot [0,0]=1, [0,1]=9 (1x2 = 10) -> 20 pts
  customGrid[0 * 11 + 0] = 1;
  customGrid[0 * 11 + 1] = 9;

  // Slot [2,2]=1, [2,3]=2, [3,2]=3, [3,3]=4 (2x2 = 10) -> 40 pts
  customGrid[2 * 11 + 2] = 1;
  customGrid[2 * 11 + 3] = 2;
  customGrid[3 * 11 + 2] = 3;
  customGrid[3 * 11 + 3] = 4;

  engine.init(customGrid, 0);

  const res1 = engine.attemptClear(0, 0, 0, 1);
  assert(res1.success === true, '1x2 selection (1+9) successfully cleared');
  assert(res1.pointsAwarded === 20, '1x2 awarded 20 points');
  assert(engine.clearSizeBreakdown[2] === 1, 'Clear size breakdown tracks 2-cell clear');

  const res2 = engine.attemptClear(2, 2, 3, 3);
  assert(res2.success === true, '2x2 selection (1+2+3+4) successfully cleared');
  assert(res2.pointsAwarded === 40, '2x2 awarded 40 points');
  assert(engine.clearSizeBreakdown[4] === 1, 'Clear size breakdown tracks 4-cell clear');
  assert(engine.score === 60, 'Total score is 60');
}

// Test 4: Tunneling on 11x15
{
  const engine = new Rect10Engine(11, 15);
  const customGrid = new Uint8Array(165);
  customGrid.fill(9);

  // [1, 0]=3, [1, 1]=0, [1, 2]=0, [1, 3]=7
  customGrid[1 * 11 + 0] = 3;
  customGrid[1 * 11 + 1] = 0;
  customGrid[1 * 11 + 2] = 0;
  customGrid[1 * 11 + 3] = 7;

  engine.init(customGrid, 0);

  const resTunnel = engine.attemptClear(1, 0, 1, 3);
  assert(resTunnel.success === true, 'Tunneling across empty spaces (3 + 0 + 0 + 7 = 10) succeeds');
  assert(resTunnel.cellsCleared === 2, 'Only active cells cleared (2 cells)');
  assert(resTunnel.pointsAwarded === 20, 'Awarded 20 points');
}

// Test 5: Deadlock on 11x15
{
  const engine = new Rect10Engine(11, 15);
  const deadGrid = new Uint8Array(165);
  deadGrid.fill(9);
  engine.init(deadGrid, 0);

  assert(engine.movesRemaining === 0, 'Deadlock detected on impossible 11x15 board');
}

// Benchmarks on 11x15
console.log('\n=== BENCHMARKS: 11x15 Hot Path Latencies ===');
{
  const engine = new Rect10Engine(11, 15);
  engine.init(null, 25);

  const QUERIES = 500000;
  const startQuery = performance.now();
  let dummy = 0;
  for (let i = 0; i < QUERIES; i++) {
    const r1 = (i % 15);
    const c1 = (i % 11);
    dummy += engine.getRectangleSum(r1, c1, 14, 10);
  }
  const endQuery = performance.now();
  const queryDurationMs = endQuery - startQuery;
  const nsPerQuery = (queryDurationMs / QUERIES) * 1e6;
  console.log(`Prefix Sum Query (11x15): ${QUERIES.toLocaleString()} queries in ${queryDurationMs.toFixed(2)}ms (${nsPerQuery.toFixed(1)} ns/query)`);
  assert(nsPerQuery < 50, 'Prefix Sum query latency < 50ns');

  const SEARCHES = 500;
  const startSearch = performance.now();
  for (let i = 0; i < SEARCHES; i++) {
    engine.countValidMoves();
  }
  const endSearch = performance.now();
  const searchDurationMs = endSearch - startSearch;
  const msPerSearch = searchDurationMs / SEARCHES;
  console.log(`Move Finder (11x15): ${SEARCHES} board scans in ${searchDurationMs.toFixed(2)}ms (${msPerSearch.toFixed(3)} ms/scan)`);
  assert(msPerSearch < 1.0, 'Move Finder board scan latency < 1.0ms');
}

console.log('\n🎉 ALL 11x15 TESTS & BENCHMARKS PASSED SUCCESSFULLY!\n');

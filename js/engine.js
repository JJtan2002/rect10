/**
 * Rect10 Engine
 * Zero-allocation, parameterized game logic and 2D prefix sums for Rect10.
 * Configured for portrait mobile display (11 columns x 15 rows = 165 cells).
 */

const DEFAULT_COLS = 11;
const DEFAULT_ROWS = 15;
const TARGET_SUM = 10;
const POINTS_PER_CELL = 10;

// Weighted frequencies for digits 1-9 to ensure multi-cell rectangles (2x2, 1x3, 1x4) exist.
// Low-number bias: {1: 18%, 2: 18%, 3: 16%, 4: 14%, 5: 12%, 6: 8%, 7: 6%, 8: 4%, 9: 4%}
const CUMULATIVE_WEIGHTS = new Float32Array([
  0.18, // 1
  0.36, // 2
  0.52, // 3
  0.66, // 4
  0.78, // 5
  0.86, // 6
  0.92, // 7
  0.96, // 8
  1.00  // 9
]);

class Rect10Engine {
  constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.COLS = cols;
    this.ROWS = rows;
    this.CELL_COUNT = cols * rows; // 11 * 15 = 165
    this.PREFIX_STRIDE = cols + 1; // 12
    this.PREFIX_COUNT = (rows + 1) * this.PREFIX_STRIDE; // 16 * 12 = 192

    this.TARGET_SUM = TARGET_SUM;
    this.POINTS_PER_CELL = POINTS_PER_CELL;

    // Flat typed arrays
    this.grid = new Uint8Array(this.CELL_COUNT);
    this.prefixSum = new Int16Array(this.PREFIX_COUNT);

    // Metrics & Score
    this.score = 0;
    this.clearsCount = 0;
    this.cellsClearedTotal = 0;
    this.movesRemaining = 0;
    this.largestClear = 0;

    // Detailed stats breakdown for end-game report
    this.clearSizeBreakdown = {
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      '6+': 0
    };
  }

  sampleWeightedDigit() {
    const r = Math.random();
    for (let i = 0; i < 9; i++) {
      if (r < CUMULATIVE_WEIGHTS[i]) {
        return i + 1;
      }
    }
    return 9;
  }

  init(customGrid = null, minMoves = 20) {
    this.score = 0;
    this.clearsCount = 0;
    this.cellsClearedTotal = 0;
    this.largestClear = 0;
    this.clearSizeBreakdown = { 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };

    if (customGrid) {
      for (let i = 0; i < this.CELL_COUNT; i++) {
        this.grid[i] = customGrid[i];
      }
      this.buildPrefixSums();
      this.movesRemaining = this.countValidMoves();
      return this;
    }

    let attempts = 0;
    do {
      for (let i = 0; i < this.CELL_COUNT; i++) {
        this.grid[i] = this.sampleWeightedDigit();
      }
      this.buildPrefixSums();
      this.movesRemaining = this.countValidMoves();
      attempts++;
    } while (this.movesRemaining < minMoves && attempts < 100);

    return this;
  }

  buildPrefixSums() {
    const P = this.prefixSum;
    const G = this.grid;
    const COLS = this.COLS;
    const ROWS = this.ROWS;
    const stride = this.PREFIX_STRIDE;
    P.fill(0);

    for (let r = 0; r < ROWS; r++) {
      const rOffset = r * COLS;
      const pCurrentRow = (r + 1) * stride;
      const pPrevRow = r * stride;

      for (let c = 0; c < COLS; c++) {
        const val = G[rOffset + c];
        P[pCurrentRow + (c + 1)] = val 
          + P[pCurrentRow + c] 
          + P[pPrevRow + (c + 1)] 
          - P[pPrevRow + c];
      }
    }
  }

  getRectangleSum(r1, c1, r2, c2) {
    const minR = r1 < r2 ? r1 : r2;
    const maxR = r1 < r2 ? r2 : r1;
    const minC = c1 < c2 ? c1 : c2;
    const maxC = c1 < c2 ? c2 : c1;

    const P = this.prefixSum;
    const stride = this.PREFIX_STRIDE;
    const rBottom = maxR + 1;
    const cRight = maxC + 1;

    return P[rBottom * stride + cRight]
         - P[minR * stride + cRight]
         - P[rBottom * stride + minC]
         + P[minR * stride + minC];
  }

  getActiveCellCount(r1, c1, r2, c2) {
    const minR = r1 < r2 ? r1 : r2;
    const maxR = r1 < r2 ? r2 : r1;
    const minC = c1 < c2 ? c1 : c2;
    const maxC = c1 < c2 ? c2 : c1;

    let count = 0;
    const G = this.grid;
    const COLS = this.COLS;

    for (let r = minR; r <= maxR; r++) {
      const rOffset = r * COLS;
      for (let c = minC; c <= maxC; c++) {
        if (G[rOffset + c] > 0) {
          count++;
        }
      }
    }
    return count;
  }

  attemptClear(r1, c1, r2, c2) {
    const sum = this.getRectangleSum(r1, c1, r2, c2);

    if (sum !== TARGET_SUM) {
      return {
        success: false,
        reason: 'SUM_MISMATCH',
        sum: sum,
        pointsAwarded: 0,
        cellsCleared: 0,
        movesRemaining: this.movesRemaining
      };
    }

    const minR = r1 < r2 ? r1 : r2;
    const maxR = r1 < r2 ? r2 : r1;
    const minC = c1 < c2 ? c1 : c2;
    const maxC = c1 < c2 ? c2 : c1;

    const clearedIndices = [];
    const G = this.grid;
    const COLS = this.COLS;

    for (let r = minR; r <= maxR; r++) {
      const rOffset = r * COLS;
      for (let c = minC; c <= maxC; c++) {
        const idx = rOffset + c;
        if (G[idx] > 0) {
          clearedIndices.push(idx);
          G[idx] = 0; // Turn into empty space
        }
      }
    }

    const activeCount = clearedIndices.length;
    if (activeCount === 0) {
      return {
        success: false,
        reason: 'NO_ACTIVE_CELLS',
        sum: 0,
        pointsAwarded: 0,
        cellsCleared: 0,
        movesRemaining: this.movesRemaining
      };
    }

    const points = activeCount * POINTS_PER_CELL;
    this.score += points;
    this.clearsCount++;
    this.cellsClearedTotal += activeCount;
    if (activeCount > this.largestClear) {
      this.largestClear = activeCount;
    }

    // Track size breakdown
    if (activeCount in this.clearSizeBreakdown) {
      this.clearSizeBreakdown[activeCount]++;
    } else {
      this.clearSizeBreakdown['6+']++;
    }

    this.buildPrefixSums();
    this.movesRemaining = this.countValidMoves();

    return {
      success: true,
      pointsAwarded: points,
      cellsCleared: activeCount,
      clearedIndices: clearedIndices,
      newScore: this.score,
      movesRemaining: this.movesRemaining,
      isDeadlocked: this.movesRemaining === 0
    };
  }

  countValidMoves() {
    let count = 0;
    const ROWS = this.ROWS;
    const COLS = this.COLS;

    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        for (let r2 = r1; r2 < ROWS; r2++) {
          const startSum = this.getRectangleSum(r1, c1, r2, c1);
          if (startSum > TARGET_SUM) {
            break;
          }

          for (let c2 = c1; c2 < COLS; c2++) {
            const sum = this.getRectangleSum(r1, c1, r2, c2);

            if (sum === TARGET_SUM) {
              if (this.getActiveCellCount(r1, c1, r2, c2) > 0) {
                count++;
              }
            } else if (sum > TARGET_SUM) {
              break;
            }
          }
        }
      }
    }
    return count;
  }

  findAllValidMoves(limit = Infinity) {
    const moves = [];
    const ROWS = this.ROWS;
    const COLS = this.COLS;

    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        for (let r2 = r1; r2 < ROWS; r2++) {
          if (this.getRectangleSum(r1, c1, r2, c1) > TARGET_SUM) {
            break;
          }

          for (let c2 = c1; c2 < COLS; c2++) {
            const sum = this.getRectangleSum(r1, c1, r2, c2);

            if (sum === TARGET_SUM) {
              const activeCount = this.getActiveCellCount(r1, c1, r2, c2);
              if (activeCount > 0) {
                moves.push({ r1, c1, r2, c2, activeCount });
                if (moves.length >= limit) return moves;
              }
            } else if (sum > TARGET_SUM) {
              break;
            }
          }
        }
      }
    }
    return moves;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Engine, DEFAULT_COLS, DEFAULT_ROWS, TARGET_SUM, POINTS_PER_CELL };
} else if (typeof window !== 'undefined') {
  window.Rect10Engine = Rect10Engine;
}

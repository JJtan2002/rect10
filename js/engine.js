/**
 * Rect10 Engine
 * Zero-allocation, parameterized game logic and 2D prefix sums for Rect10.
 * Supports configurable portrait mobile displays:
 * - Small: 7 columns x 10 rows (70 cells)
 * - Medium: 9 columns x 12 rows (108 cells)
 * - Large: 11 columns x 15 rows (165 cells)
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
    this.TARGET_SUM = TARGET_SUM;
    this.POINTS_PER_CELL = POINTS_PER_CELL;

    this.configureDimensions(cols, rows);

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

  configureDimensions(cols, rows) {
    this.COLS = cols;
    this.ROWS = rows;
    this.CELL_COUNT = cols * rows;
    this.PREFIX_STRIDE = cols + 1;
    this.PREFIX_COUNT = (rows + 1) * this.PREFIX_STRIDE;

    this.grid = new Uint8Array(this.CELL_COUNT);
    this.prefixSum = new Int16Array(this.PREFIX_COUNT);
  }

  setDimensions(cols, rows) {
    if (this.COLS === cols && this.ROWS === rows) return;
    this.configureDimensions(cols, rows);
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

  init(customGrid = null, minMoves = null) {
    this.score = 0;
    this.clearsCount = 0;
    this.cellsClearedTotal = 0;
    this.largestClear = 0;
    this.clearSizeBreakdown = { 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };

    // Default minMoves according to board size
    let requiredMoves = minMoves;
    if (requiredMoves === null || requiredMoves === undefined) {
      if (this.CELL_COUNT <= 80) requiredMoves = 10;
      else if (this.CELL_COUNT <= 120) requiredMoves = 15;
      else requiredMoves = 20;
    }

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
    } while (this.movesRemaining < requiredMoves && attempts < 100);

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
      const gRowOffset = r * COLS;
      const pCurrRowOffset = (r + 1) * stride;
      const pPrevRowOffset = r * stride;

      for (let c = 0; c < COLS; c++) {
        const val = G[gRowOffset + c];
        P[pCurrRowOffset + (c + 1)] = 
          val + 
          P[pPrevRowOffset + (c + 1)] + 
          P[pCurrRowOffset + c] - 
          P[pPrevRowOffset + c];
      }
    }
  }

  getRegionSum(r1, c1, r2, c2) {
    const top = Math.min(r1, r2);
    const bottom = Math.max(r1, r2);
    const left = Math.min(c1, c2);
    const right = Math.max(c1, c2);

    const stride = this.PREFIX_STRIDE;
    const P = this.prefixSum;

    const A = P[top * stride + left];
    const B = P[top * stride + (right + 1)];
    const C = P[(bottom + 1) * stride + left];
    const D = P[(bottom + 1) * stride + (right + 1)];

    return D - B - C + A;
  }

  getRectangleSum(r1, c1, r2, c2) {
    return this.getRegionSum(r1, c1, r2, c2);
  }

  countValidMoves() {
    let count = 0;
    const ROWS = this.ROWS;
    const COLS = this.COLS;

    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        for (let r2 = r1; r2 < ROWS; r2++) {
          for (let c2 = c1; c2 < COLS; c2++) {
            const sum = this.getRegionSum(r1, c1, r2, c2);
            if (sum === this.TARGET_SUM) {
              if (this.hasAtLeastOneActive(r1, c1, r2, c2)) {
                count++;
              }
            } else if (sum > this.TARGET_SUM) {
              break;
            }
          }
        }
      }
    }
    return count;
  }

  findAllValidMoves(limit = 100) {
    const moves = [];
    const ROWS = this.ROWS;
    const COLS = this.COLS;

    for (let r1 = 0; r1 < ROWS; r1++) {
      for (let c1 = 0; c1 < COLS; c1++) {
        for (let r2 = r1; r2 < ROWS; r2++) {
          for (let c2 = c1; c2 < COLS; c2++) {
            const sum = this.getRegionSum(r1, c1, r2, c2);
            if (sum === this.TARGET_SUM) {
              if (this.hasAtLeastOneActive(r1, c1, r2, c2)) {
                moves.push({ r1, c1, r2, c2 });
                if (moves.length >= limit) return moves;
              }
            } else if (sum > this.TARGET_SUM) {
              break;
            }
          }
        }
      }
    }
    return moves;
  }

  hasAtLeastOneActive(r1, c1, r2, c2) {
    const top = Math.min(r1, r2);
    const bottom = Math.max(r1, r2);
    const left = Math.min(c1, c2);
    const right = Math.max(c1, c2);
    const G = this.grid;
    const COLS = this.COLS;

    for (let r = top; r <= bottom; r++) {
      const rowOffset = r * COLS;
      for (let c = left; c <= right; c++) {
        if (G[rowOffset + c] > 0) return true;
      }
    }
    return false;
  }

  attemptClear(r1, c1, r2, c2) {
    const sum = this.getRegionSum(r1, c1, r2, c2);

    if (sum !== this.TARGET_SUM) {
      return {
        success: false,
        reason: 'SUM_MISMATCH',
        sum: sum,
        pointsAwarded: 0,
        clearedIndices: []
      };
    }

    const top = Math.min(r1, r2);
    const bottom = Math.max(r1, r2);
    const left = Math.min(c1, c2);
    const right = Math.max(c1, c2);

    let activeCellsCleared = 0;
    const clearedIndices = [];
    const G = this.grid;
    const COLS = this.COLS;

    for (let r = top; r <= bottom; r++) {
      const rowOffset = r * COLS;
      for (let c = left; c <= right; c++) {
        const idx = rowOffset + c;
        if (G[idx] > 0) {
          G[idx] = 0;
          activeCellsCleared++;
          clearedIndices.push({ r, c, index: idx });
        }
      }
    }

    if (activeCellsCleared === 0) {
      return {
        success: false,
        reason: 'ONLY_ZEROS',
        sum: 0,
        pointsAwarded: 0,
        clearedIndices: []
      };
    }

    const points = activeCellsCleared * this.POINTS_PER_CELL;
    this.score += points;
    this.clearsCount++;
    this.cellsClearedTotal += activeCellsCleared;

    if (activeCellsCleared > this.largestClear) {
      this.largestClear = activeCellsCleared;
    }

    if (activeCellsCleared in this.clearSizeBreakdown) {
      this.clearSizeBreakdown[activeCellsCleared]++;
    } else {
      this.clearSizeBreakdown['6+']++;
    }

    this.buildPrefixSums();
    this.movesRemaining = this.countValidMoves();

    return {
      success: true,
      pointsAwarded: points,
      activeCellsCleared: activeCellsCleared,
      cellsCleared: activeCellsCleared,
      clearedIndices: clearedIndices,
      newScore: this.score,
      movesRemaining: this.movesRemaining,
      isDeadlocked: this.movesRemaining === 0
    };
  }

  getCellValue(r, c) {
    if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return 0;
    return this.grid[r * this.COLS + c];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10Engine, DEFAULT_COLS, DEFAULT_ROWS, TARGET_SUM, POINTS_PER_CELL };
}

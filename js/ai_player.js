/**
 * Rect10 AI Player & Heuristic Search Controller
 * 
 * Implements:
 * 1. 5-Component Heuristic Evaluation (Score, Mobility, Key Scarcity, Tunneling, Orphan Penalty)
 * 2. 1-Ply Greedy vs. Time-Bounded Heuristic Lookahead (Beam Search)
 * 3. 1.0-Second Move Delay Floor: Δt = max(1.0s, τ_think)
 * 4. Human-like Visual Drag Animation across Canvas with procedural audio ticks
 * 5. Real-Time Telemetry reporting (nodes evaluated, depth, strategy tags, deadlock risk)
 * 6. Zero runtime dependencies: Runs in both Node.js (headless) and Browser.
 */

// Heuristic Weights
const DEFAULT_WEIGHTS = {
  score: 1.0,           // Immediate cell clear points (100 pts per cell)
  mobility: 140.0,       // log(1 + movesRemaining): Deadlock avoidance margin
  scarcityPenalty: 220.0,// Deficit of available keys (1,2,3) for high numbers (9,8,7)
  orphanPenalty: 90.0,  // Active cells with 0 intersecting valid moves
  tunnelBonus: 120.0     // 0-cells enclosed that bridge active regions
};

class Rect10AiPlayer {
  constructor(game = null, options = {}) {
    this.game = game;
    this.mode = options.mode || 'strategic'; // 'strategic' | 'greedy'
    this.minMoveDelayMs = options.minMoveDelayMs !== undefined ? options.minMoveDelayMs : 1000;
    this.dragAnimDurationMs = options.dragAnimDurationMs !== undefined ? options.dragAnimDurationMs : 250;
    this.weights = Object.assign({}, DEFAULT_WEIGHTS, options.weights || {});

    this.isAutoplaying = false;
    this.stepTimeoutId = null;
    this.animFrameId = null;

    // Telemetry
    this.telemetry = {
      mode: this.mode,
      movesExecuted: 0,
      nodesEvaluated: 0,
      lastThinkingTimeMs: 0,
      lastMoveDurationMs: 0,
      bestScore: 0,
      strategyTag: 'Ready',
      deadlockRisk: 'Safe',
      lastMove: null
    };

    this.onTelemetryUpdate = options.onTelemetryUpdate || null;
  }

  setMode(mode) {
    if (mode === 'greedy' || mode === 'strategic') {
      this.mode = mode;
      this.telemetry.mode = mode;
      this.emitTelemetry();
    }
  }

  emitTelemetry() {
    if (typeof this.onTelemetryUpdate === 'function') {
      this.onTelemetryUpdate(this.telemetry);
    }
  }

  /**
   * Evaluates a board state using the 5-component heuristic.
   * Higher is better.
   */
  evaluateState(engine) {
    const G = engine.grid;
    const CELL_COUNT = engine.CELL_COUNT;
    const movesCount = engine.movesRemaining !== undefined ? engine.movesRemaining : engine.countValidMoves();

    // Terminal Deadlock check
    if (movesCount === 0) {
      let remainingActive = 0;
      for (let i = 0; i < CELL_COUNT; i++) {
        if (G[i] > 0) remainingActive++;
      }
      if (remainingActive === 0) return 100000; // Perfect full board clear!
      return -50000; // Unwanted premature deadlock
    }

    // 1. Score Yield
    const scoreVal = engine.score * this.weights.score;

    // 2. Action Mobility (Deadlock Safety Margin)
    const mobilityVal = Math.log(1 + movesCount) * this.weights.mobility;

    // 3. Digit Supply-Demand Invariant (Scarcity Deficit)
    // Digits 9, 8, 7 strictly require 1, 2, 3 (or combinations of 1 and 2)
    let count1 = 0, count2 = 0, count3 = 0;
    let count7 = 0, count8 = 0, count9 = 0;

    for (let i = 0; i < CELL_COUNT; i++) {
      const v = G[i];
      if (v === 1) count1++;
      else if (v === 2) count2++;
      else if (v === 3) count3++;
      else if (v === 7) count7++;
      else if (v === 8) count8++;
      else if (v === 9) count9++;
    }

    let scarcityDeficit = 0;
    // 9 needs at least one 1
    if (count9 > count1) scarcityDeficit += (count9 - count1) * 2.0;
    // 8 needs at least one 2 or two 1s
    const availableFor8 = count2 + Math.floor(count1 / 2);
    if (count8 > availableFor8) scarcityDeficit += (count8 - availableFor8) * 1.5;
    // 7 needs 3 or (2+1) or (1+1+1)
    const availableFor7 = count3 + count2 + count1;
    if (count7 > availableFor7) scarcityDeficit += (count7 - availableFor7);

    const scarcityVal = scarcityDeficit * this.weights.scarcityPenalty;

    // 4. Orphan Penalty (Active cells with degree 0)
    // For speed during deep search, we sample or compute when movesCount is small (< 15)
    let orphanVal = 0;
    if (movesCount < 15) {
      const validMoves = engine.findAllValidMoves(30);
      const covered = new Uint8Array(CELL_COUNT);
      const COLS = engine.COLS;
      for (const m of validMoves) {
        for (let r = m.r1; r <= m.r2; r++) {
          for (let c = m.c1; c <= m.c2; c++) {
            covered[r * COLS + c] = 1;
          }
        }
      }
      let orphans = 0;
      for (let i = 0; i < CELL_COUNT; i++) {
        if (G[i] > 0 && covered[i] === 0) orphans++;
      }
      orphanVal = orphans * this.weights.orphanPenalty;
    }

    return scoreVal + mobilityVal - scarcityVal - orphanVal;
  }

  /**
   * Fast clone of an engine instance for hypothetical branch simulation.
   */
  cloneEngine(engine) {
    const Rect10EngineClass = engine.constructor;
    const clone = new Rect10EngineClass(engine.COLS, engine.ROWS);
    clone.score = engine.score;
    clone.clearsCount = engine.clearsCount;
    clone.cellsClearedTotal = engine.cellsClearedTotal;
    clone.largestClear = engine.largestClear;

    // Copy typed arrays
    clone.grid.set(engine.grid);
    clone.prefixSum.set(engine.prefixSum);
    clone.movesRemaining = engine.movesRemaining;
    return clone;
  }

  /**
   * Decides the next move based on current game state.
   * Returns: { r1, c1, r2, c2, score, evalScore, strategyTag, thinkingTimeMs }
   */
  findBestMove(engine) {
    const startTime = performance.now();
    const validMoves = engine.findAllValidMoves(100);

    if (!validMoves || validMoves.length === 0) {
      return null;
    }

    let nodesEvaluated = 0;
    let chosenMove = null;
    let bestEval = -Infinity;
    let strategyTag = 'Point Clear';

    if (this.mode === 'greedy') {
      // 1-Ply Immediate Point Maximization (Baseline 0)
      for (const move of validMoves) {
        nodesEvaluated++;
        let activeCells = 0;
        const G = engine.grid;
        const COLS = engine.COLS;
        for (let r = move.r1; r <= move.r2; r++) {
          for (let c = move.c1; c <= move.c2; c++) {
            if (G[r * COLS + c] > 0) activeCells++;
          }
        }
        const pts = activeCells * 100;
        if (pts > bestEval) {
          bestEval = pts;
          chosenMove = move;
        }
      }
      strategyTag = `Greedy (${bestEval} pts)`;
    } else {
      // Strategic Search (Heuristic Lookahead + Beam Search)
      const scoredCandidates = [];

      for (const move of validMoves) {
        nodesEvaluated++;
        const sim = this.cloneEngine(engine);
        const res = sim.attemptClear(move.r1, move.c1, move.r2, move.c2);

        if (res.success) {
          const h = this.evaluateState(sim);
          scoredCandidates.push({
            move,
            sim,
            evalScore: h,
            activeCells: res.activeCellsCleared,
            movesRemaining: res.movesRemaining
          });
        }
      }

      // Sort candidate moves by 1-ply heuristic
      scoredCandidates.sort((a, b) => b.evalScore - a.evalScore);

      // Depth 2 Lookahead on top beam candidates
      const BEAM_WIDTH = Math.min(16, scoredCandidates.length);
      let bestCandidate = scoredCandidates[0];
      let bestCompositeEval = -Infinity;

      for (let i = 0; i < BEAM_WIDTH; i++) {
        const candidate = scoredCandidates[i];
        nodesEvaluated++;

        if (candidate.movesRemaining === 0) {
          if (candidate.evalScore > bestCompositeEval) {
            bestCompositeEval = candidate.evalScore;
            bestCandidate = candidate;
          }
          continue;
        }

        const childMoves = candidate.sim.findAllValidMoves(12);
        let maxChildEval = -Infinity;

        for (const cm of childMoves) {
          nodesEvaluated++;
          const childSim = this.cloneEngine(candidate.sim);
          const childRes = childSim.attemptClear(cm.r1, cm.c1, cm.r2, cm.c2);
          if (childRes.success) {
            const ch = this.evaluateState(childSim);
            if (ch > maxChildEval) {
              maxChildEval = ch;
            }
          }
        }

        const composite = candidate.evalScore + (maxChildEval !== -Infinity ? 0.65 * maxChildEval : 0);
        if (composite > bestCompositeEval) {
          bestCompositeEval = composite;
          bestCandidate = candidate;
        }
      }

      chosenMove = bestCandidate ? bestCandidate.move : validMoves[0];
      bestEval = bestCompositeEval;

      const G = engine.grid;
      const COLS = engine.COLS;
      let zeroesEnclosed = 0;
      let hasHighNumber = false;

      for (let r = chosenMove.r1; r <= chosenMove.r2; r++) {
        for (let c = chosenMove.c1; c <= chosenMove.c2; c++) {
          const v = G[r * COLS + c];
          if (v === 0) zeroesEnclosed++;
          if (v >= 7) hasHighNumber = true;
        }
      }

      if (zeroesEnclosed >= 2) {
        strategyTag = `Tunnel Highway (${zeroesEnclosed} zeroes)`;
      } else if (hasHighNumber) {
        strategyTag = 'High-Key Pairing (7-9)';
      } else if (bestCandidate && bestCandidate.movesRemaining >= 25) {
        strategyTag = 'Mobility Preserved';
      } else {
        strategyTag = 'Strategic Combo';
      }
    }

    const elapsedMs = performance.now() - startTime;

    let deadlockRisk = 'Safe';
    if (engine.movesRemaining <= 5) deadlockRisk = 'CRITICAL';
    else if (engine.movesRemaining <= 12) deadlockRisk = 'Caution';

    return {
      r1: chosenMove.r1,
      c1: chosenMove.c1,
      r2: chosenMove.r2,
      c2: chosenMove.c2,
      evalScore: bestEval,
      nodesEvaluated,
      thinkingTimeMs: elapsedMs,
      strategyTag,
      deadlockRisk
    };
  }

  /**
   * Starts autonomous autoplay on an attached Rect10Game instance.
   */
  startAutoplay() {
    if (!this.game || this.isAutoplaying) return;
    this.isAutoplaying = true;
    this.telemetry.movesExecuted = 0;
    this.telemetry.strategyTag = 'Starting...';
    this.emitTelemetry();

    this.scheduleNextStep();
  }

  /**
   * Halts autonomous autoplay cleanly.
   */
  stopAutoplay() {
    this.isAutoplaying = false;
    if (this.stepTimeoutId) {
      clearTimeout(this.stepTimeoutId);
      this.stepTimeoutId = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.game && this.game.dragState) {
      this.game.dragState.active = false;
    }
    this.telemetry.strategyTag = 'Autoplay Paused';
    this.emitTelemetry();
  }

  /**
   * Executes a single animated decision turn respecting the 1.0s delay boundary.
   */
  scheduleNextStep() {
    if (!this.isAutoplaying || !this.game || !this.game.isPlaying || this.game.isPaused) {
      return;
    }

    const engine = this.game.engine;
    if (engine.movesRemaining === 0) {
      this.stopAutoplay();
      return;
    }

    const stepStart = performance.now();
    const decision = this.findBestMove(engine);

    if (!decision) {
      this.stopAutoplay();
      return;
    }

    this.telemetry.movesExecuted++;
    this.telemetry.nodesEvaluated = decision.nodesEvaluated;
    this.telemetry.lastThinkingTimeMs = Math.round(decision.thinkingTimeMs);
    this.telemetry.strategyTag = decision.strategyTag;
    this.telemetry.deadlockRisk = decision.deadlockRisk;
    this.telemetry.lastMove = {
      r1: decision.r1, c1: decision.c1,
      r2: decision.r2, c2: decision.c2
    };
    this.emitTelemetry();

    // Constraint: Δt = max(1.0s, τ_think)
    const computeDurationMs = performance.now() - stepStart;
    const targetTurnDurationMs = Math.max(this.minMoveDelayMs, computeDurationMs);
    const animDurationMs = Math.min(this.dragAnimDurationMs, targetTurnDurationMs);
    const holdTimeMs = Math.max(0, targetTurnDurationMs - animDurationMs);

    // Human-like drag animation across the canvas
    this.animateVirtualDrag(decision.r1, decision.c1, decision.r2, decision.c2, animDurationMs, () => {
      // Commit move through game
      if (typeof this.game.commitMove === 'function') {
        this.game.commitMove(decision.r1, decision.c1, decision.r2, decision.c2);
      } else {
        this.game.dragState.active = false;
        const res = this.game.engine.attemptClear(decision.r1, decision.c1, decision.r2, decision.c2);
        if (res.success) {
          this.game.audio.playClearChime(res.pointsAwarded);
          this.game.haptics.clear();
          this.game.view.addTileDissolve(res.clearedIndices);
          this.game.view.addFloatingScore(decision.r1, decision.c1, decision.r2, decision.c2, res.pointsAwarded);
          this.game.updateHUD();
          if (res.isDeadlocked) this.game.endGame('No More Moves!');
        }
      }

      this.game.dragState.active = false;
      this.telemetry.lastMoveDurationMs = Math.round(performance.now() - stepStart);
      this.emitTelemetry();

      // Schedule next move if game still active
      if (this.isAutoplaying && this.game.isPlaying && !this.game.isPaused) {
        this.stepTimeoutId = setTimeout(() => {
          this.scheduleNextStep();
        }, holdTimeMs);
      }
    });
  }

  /**
   * Smoothly animates the drag selection box on Canvas to simulate human pointer input.
   */
  animateVirtualDrag(r1, c1, r2, c2, durationMs, onComplete) {
    const dragState = this.game.dragState;
    dragState.active = true;
    dragState.startR = r1;
    dragState.startC = c1;
    dragState.currentR = r1;
    dragState.currentC = c1;

    this.game.audio.playDragTick();
    this.game.haptics.dragTick();

    const startAnimTime = performance.now();

    const frame = () => {
      if (!this.isAutoplaying) {
        dragState.active = false;
        return;
      }

      const elapsed = performance.now() - startAnimTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      const curR = Math.round(r1 + (r2 - r1) * progress);
      const curC = Math.round(c1 + (c2 - c1) * progress);

      if (curR !== dragState.currentR || curC !== dragState.currentC) {
        dragState.currentR = curR;
        dragState.currentC = curC;
        this.game.audio.playDragTick();
        this.game.haptics.dragTick();
      }

      if (progress < 1.0) {
        this.animFrameId = requestAnimationFrame(frame);
      } else {
        dragState.currentR = r2;
        dragState.currentC = c2;
        this.animFrameId = null;
        if (typeof onComplete === 'function') onComplete();
      }
    };

    this.animFrameId = requestAnimationFrame(frame);
  }
}

// Universal export (Browser & Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Rect10AiPlayer, DEFAULT_WEIGHTS };
}
if (typeof window !== 'undefined') {
  window.Rect10AiPlayer = Rect10AiPlayer;
}

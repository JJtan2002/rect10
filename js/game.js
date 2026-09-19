/**
 * Rect10 Game Controller & Application Coordinator (Phase 5)
 * Coordinates:
 * - Mathematical Engine & Typed Array 2D Prefix Sums
 * - High-DPI Canvas 2D View & Tile Dissolve Animations
 * - Procedural Web Audio Acoustic Synthesizer
 * - Multi-Tier Persistent Leaderboard (Daily, Weekly, All-Time, History)
 * - Mobile Haptics Engine (Web Vibration API)
 * - Screen Wake Lock API
 * - Android Hardware Back Button & Browser Gesture Navigation
 */

class Rect10Game {
  constructor() {
    this.engine = new Rect10Engine(11, 15);
    this.audio = new Rect10Audio();
    this.leaderboard = new Rect10Leaderboard();
    this.haptics = new Rect10Haptics();

    // DOM Elements - HUD
    this.canvas = document.getElementById('gameCanvas');
    this.view = new Rect10View(this.canvas);

    this.timerEl = document.getElementById('hudTimer');
    this.timerBarFill = document.getElementById('timerBarFill');
    this.scoreEl = document.getElementById('hudScore');
    this.movesEl = document.getElementById('hudMoves');
    this.bestScoreEl = document.getElementById('hudBestScore');
    this.muteBtn = document.getElementById('muteBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.leaderboardBtn = document.getElementById('leaderboardBtn');
    this.hapticBtn = document.getElementById('hapticBtn');

    // DOM Elements - In-Grid Pause Curtain & Modal
    this.pauseCurtain = document.getElementById('pauseCurtain');
    this.pauseModal = document.getElementById('pauseModal');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.modalRestartBtn = document.getElementById('modalRestartBtn');

    // DOM Elements - Leaderboard Modal
    this.leaderboardModal = document.getElementById('leaderboardModal');
    this.closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    this.closeLeaderboardActionBtn = document.getElementById('closeLeaderboardActionBtn');
    this.lbAllTime = document.getElementById('lbAllTime');
    this.lbWeekly = document.getElementById('lbWeekly');
    this.lbDaily = document.getElementById('lbDaily');
    this.lbHistoryList = document.getElementById('lbHistoryList');

    // DOM Elements - Game Over Modal & Badges
    this.gameOverModal = document.getElementById('gameOverModal');
    this.allTimeBestBadge = document.getElementById('allTimeBestBadge');
    this.weeklyBestBadge = document.getElementById('weeklyBestBadge');
    this.dailyBestBadge = document.getElementById('dailyBestBadge');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalScore = document.getElementById('modalScore');
    this.modalRank = document.getElementById('modalRank');
    this.modalClears = document.getElementById('modalClears');
    this.modalCells = document.getElementById('modalCells');
    this.modalAvgSize = document.getElementById('modalAvgSize');
    this.modalLargestClear = document.getElementById('modalLargestClear');
    this.modalPace = document.getElementById('modalPace');
    this.modalBreakdown = document.getElementById('modalBreakdown');
    this.playAgainBtn = document.getElementById('playAgainBtn');
    this.copyStatsBtn = document.getElementById('copyStatsBtn');

    // Drag selection state (zero-allocation reusable struct)
    this.dragState = {
      active: false,
      startR: 0,
      startC: 0,
      currentR: 0,
      currentC: 0
    };

    // Game lifecycle state
    this.ROUND_DURATION_SEC = 100.0;
    this.timeLeft = this.ROUND_DURATION_SEC;
    this.isPlaying = false;
    this.isPaused = false;
    this.lastFrameTime = 0;
    this.wakeLock = null;

    this.highScore = this.leaderboard.getAllTimeBest();

    this.updateControlsUI();
    this.bindEvents();
    this.updateHUD();
    this.startNewGame();
    this.startLoop();
  }

  updateControlsUI() {
    this.muteBtn.textContent = this.audio.isMuted ? '🔇' : '🔊';
    this.hapticBtn.textContent = '📳';
    if (!this.haptics.isEnabled || !this.haptics.isSupported) {
      this.hapticBtn.classList.add('disabled');
    } else {
      this.hapticBtn.classList.remove('disabled');
    }
  }

  // --- Screen Wake Lock API ---
  async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch (err) {
        // Silently handle devices with battery saver or disabled wake locks
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {
        // Ignore errors on release
      }
      this.wakeLock = null;
    }
  }

  startNewGame() {
    this.engine.init(null, 20);
    this.timeLeft = this.ROUND_DURATION_SEC;
    this.isPlaying = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.dragState.active = false;
    this.highScore = this.leaderboard.getAllTimeBest();

    this.gameOverModal.classList.remove('active');
    this.pauseModal.classList.remove('active');
    this.leaderboardModal.classList.remove('active');
    this.pauseCurtain.classList.remove('active');

    this.allTimeBestBadge.classList.remove('active');
    this.weeklyBestBadge.classList.remove('active');
    this.dailyBestBadge.classList.remove('active');

    this.requestWakeLock();
    this.updateHUD();
  }

  pauseGame() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.dragState.active = false;
    this.pauseCurtain.classList.add('active');
    this.pauseModal.classList.add('active');
    this.releaseWakeLock();

    // Push dummy history entry so Android back button closes pause modal
    history.pushState({ modal: 'pause' }, '');
  }

  resumeGame() {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.pauseCurtain.classList.remove('active');
    this.pauseModal.classList.remove('active');
    this.requestWakeLock();
  }

  openLeaderboard() {
    this.haptics.buttonTap();
    this.audio.playButtonTick();

    const wasPlaying = this.isPlaying && !this.isPaused;
    if (wasPlaying) {
      this.pauseGame();
    }

    // Refresh data
    this.lbAllTime.textContent = this.leaderboard.getAllTimeBest().toString();
    this.lbWeekly.textContent = this.leaderboard.getWeeklyBest().toString();
    this.lbDaily.textContent = this.leaderboard.getTodayBest().toString();

    const history = this.leaderboard.getHistory();
    if (history.length === 0) {
      this.lbHistoryList.innerHTML = '<div class="history-empty">No completed runs recorded yet.</div>';
    } else {
      this.lbHistoryList.innerHTML = history.map((item) => {
        const d = new Date(item.timestamp);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${Rect10Leaderboard.pad(d.getHours())}:${Rect10Leaderboard.pad(d.getMinutes())}`;
        return `
          <div class="history-item">
            <span class="history-date">${dateStr}</span>
            <div class="history-right">
              <span class="history-rank">${item.rank}</span>
              <span class="history-score">${item.score} pts</span>
            </div>
          </div>
        `;
      }).join('');
    }

    this.leaderboardModal.classList.add('active');
    history.pushState({ modal: 'leaderboard' }, '');
  }

  closeLeaderboard() {
    this.leaderboardModal.classList.remove('active');
  }

  calculateRank(score) {
    if (score >= 800) return 'Grandmaster';
    if (score >= 600) return 'Master';
    if (score >= 400) return 'Tactician';
    if (score >= 200) return 'Calculator';
    return 'Novice';
  }

  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('dragstart', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const startDrag = (clientX, clientY) => {
      if (!this.isPlaying || this.isPaused) return;
      this.audio.ensureContext();

      const cell = this.view.clientToCell(clientX, clientY);
      this.dragState.active = true;
      this.dragState.startR = cell.r;
      this.dragState.startC = cell.c;
      this.dragState.currentR = cell.r;
      this.dragState.currentC = cell.c;
      this.audio.playDragTick();
      this.haptics.dragTick();
    };

    const updateDrag = (clientX, clientY) => {
      if (!this.dragState.active || !this.isPlaying || this.isPaused) return;

      const cell = this.view.clientToCell(clientX, clientY);
      if (cell.r !== this.dragState.currentR || cell.c !== this.dragState.currentC) {
        this.dragState.currentR = cell.r;
        this.dragState.currentC = cell.c;
        this.audio.playDragTick();
        this.haptics.dragTick();
      }
    };

    const endDrag = () => {
      if (!this.dragState.active) return;
      this.dragState.active = false;

      if (!this.isPlaying || this.isPaused) return;

      const res = this.engine.attemptClear(
        this.dragState.startR,
        this.dragState.startC,
        this.dragState.currentR,
        this.dragState.currentC
      );

      if (res.success) {
        this.audio.playClearChime(res.pointsAwarded);
        this.haptics.clear();
        this.view.addTileDissolve(res.clearedIndices);
        this.view.addFloatingScore(
          this.dragState.startR,
          this.dragState.startC,
          this.dragState.currentR,
          this.dragState.currentC,
          res.pointsAwarded
        );

        if (this.engine.score > this.highScore) {
          this.highScore = this.engine.score;
        }

        this.updateHUD();

        if (res.isDeadlocked) {
          this.endGame('No More Moves!');
        }
      }
    };

    // 1. Pointer Events
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && e.buttons === 0 && this.dragState.active) {
        endDrag();
        return;
      }
      updateDrag(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', () => endDrag());
    window.addEventListener('pointercancel', () => endDrag());

    // 2. Direct Mouse Events Fallback
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (e.buttons === 0 && this.dragState.active) {
        endDrag();
        return;
      }
      updateDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) endDrag();
    });

    // 3. Direct Touch Events Fallback
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => endDrag());
    window.addEventListener('touchcancel', () => endDrag());

    // UI Buttons
    this.pauseBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    });

    this.resumeBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.resumeGame();
    });

    this.modalRestartBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.startNewGame();
    });

    this.muteBtn.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
      this.haptics.buttonTap();
    });

    this.hapticBtn.addEventListener('click', () => {
      this.haptics.toggle();
      this.updateControlsUI();
    });

    this.leaderboardBtn.addEventListener('click', () => {
      this.openLeaderboard();
    });

    this.closeLeaderboardBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeLeaderboard();
    });

    this.closeLeaderboardActionBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeLeaderboard();
    });

    this.restartBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.startNewGame();
    });

    this.playAgainBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.startNewGame();
    });

    // Copy Results Button
    this.copyStatsBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      const score = this.engine.score;
      const rank = this.calculateRank(score);
      const b = this.engine.clearSizeBreakdown;
      const multi = (b[4] || 0) + (b[5] || 0) + (b['6+'] || 0);
      const text = `🎯 Rect10 Puzzle Run: ${score} pts (${rank})\n⏱️ Clears: ${this.engine.clearsCount} | Largest: ${this.engine.largestClear} blocks\n🧩 2c: ${b[2] || 0} | 3c: ${b[3] || 0} | 4c+: ${multi}`;
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.copyStatsBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            this.copyStatsBtn.textContent = '📋 Copy Result';
          }, 1500);
        });
      }
    });

    // Android Hardware Back Button & Browser History State
    window.addEventListener('popstate', () => {
      if (this.leaderboardModal.classList.contains('active')) {
        this.closeLeaderboard();
      } else if (this.pauseModal.classList.contains('active')) {
        this.resumeGame();
      } else if (this.gameOverModal.classList.contains('active')) {
        this.gameOverModal.classList.remove('active');
      } else if (this.isPlaying && !this.isPaused) {
        this.pauseGame();
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        if (this.leaderboardModal.classList.contains('active')) {
          this.closeLeaderboard();
        } else if (this.isPaused) {
          this.resumeGame();
        } else if (this.isPlaying) {
          this.pauseGame();
        }
      } else if ((e.code === 'Space' || e.code === 'Enter') && !this.isPlaying && !this.leaderboardModal.classList.contains('active')) {
        e.preventDefault();
        this.startNewGame();
      }
    });

    // Page Visibility & Window Blur Handling
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.releaseWakeLock();
        if (this.isPlaying && !this.isPaused) {
          this.pauseGame();
        }
      } else if (document.visibilityState === 'visible') {
        if (this.isPlaying && !this.isPaused) {
          this.requestWakeLock();
        }
      }
    });

    window.addEventListener('blur', () => {
      if (this.isPlaying && !this.isPaused) {
        this.pauseGame();
      }
    });
  }

  updateHUD() {
    this.timerEl.textContent = Math.ceil(this.timeLeft).toString();
    this.scoreEl.textContent = this.engine.score.toString();
    this.movesEl.textContent = this.engine.movesRemaining.toString();
    this.bestScoreEl.textContent = this.leaderboard.getAllTimeBest().toString();

    // Update Progress Bar
    const pct = Math.max(0, Math.min(100, (this.timeLeft / this.ROUND_DURATION_SEC) * 100));
    this.timerBarFill.style.width = `${pct}%`;

    if (this.timeLeft <= 12) {
      this.timerBarFill.className = 'timer-bar-fill critical';
    } else if (this.timeLeft <= 30) {
      this.timerBarFill.className = 'timer-bar-fill warning';
    } else {
      this.timerBarFill.className = 'timer-bar-fill';
    }
  }

  endGame(reason) {
    this.isPlaying = false;
    this.isPaused = false;
    this.dragState.active = false;
    this.releaseWakeLock();

    this.pauseCurtain.classList.remove('active');
    this.pauseModal.classList.remove('active');
    this.leaderboardModal.classList.remove('active');

    // Analytics calculations
    const score = this.engine.score;
    const rank = this.calculateRank(score);
    const elapsedSec = Math.max(1, this.ROUND_DURATION_SEC - this.timeLeft);
    const cpm = ((this.engine.clearsCount / elapsedSec) * 60).toFixed(1);

    this.modalTitle.textContent = reason;
    this.modalScore.textContent = score.toString();
    this.modalRank.textContent = rank;
    this.modalClears.textContent = this.engine.clearsCount.toString();
    this.modalCells.textContent = this.engine.cellsClearedTotal.toString();
    this.modalLargestClear.textContent = `${this.engine.largestClear} blocks`;
    this.modalPace.textContent = `${cpm} CPM`;

    const avgSize = this.engine.clearsCount > 0 
      ? (this.engine.cellsClearedTotal / this.engine.clearsCount).toFixed(1)
      : '0.0';
    this.modalAvgSize.textContent = `${avgSize} cells`;

    const b = this.engine.clearSizeBreakdown;
    const multiCell = (b[4] || 0) + (b[5] || 0) + (b['6+'] || 0);
    this.modalBreakdown.textContent = `2c: ${b[2] || 0} | 3c: ${b[3] || 0} | 4c+: ${multiCell}`;

    // Record score into multi-tier leaderboard
    const milestones = this.leaderboard.recordScore(score, {
      rank,
      clearsCount: this.engine.clearsCount,
      cellsClearedTotal: this.engine.cellsClearedTotal,
      largestClear: this.engine.largestClear,
      paceCPM: cpm
    });

    this.allTimeBestBadge.classList.remove('active');
    this.weeklyBestBadge.classList.remove('active');
    this.dailyBestBadge.classList.remove('active');

    if (milestones.isNewAllTime && score > 0) {
      this.allTimeBestBadge.classList.add('active');
      this.audio.playNewRecordFanfare();
      this.haptics.newRecord();
    } else if (milestones.isNewWeekly && score > 0) {
      this.weeklyBestBadge.classList.add('active');
      this.audio.playNewRecordFanfare();
      this.haptics.newRecord();
    } else if (milestones.isNewDaily && score > 0) {
      this.dailyBestBadge.classList.add('active');
      this.audio.playNewRecordFanfare();
      this.haptics.newRecord();
    } else {
      this.audio.playGameOverTone();
      this.haptics.gameOver();
    }

    this.highScore = this.leaderboard.getAllTimeBest();
    this.updateHUD();

    this.gameOverModal.classList.add('active');
    history.pushState({ modal: 'gameover' }, '');
  }

  startLoop() {
    const loop = (currentTime) => {
      const deltaSec = Math.min(0.1, (currentTime - this.lastFrameTime) / 1000);
      this.lastFrameTime = currentTime;

      if (this.isPlaying && !this.isPaused) {
        this.timeLeft -= deltaSec;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.updateHUD();
          this.endGame("Time's Up!");
        } else {
          this.updateHUD();
        }
      }

      this.view.render(this.engine, this.dragState);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Rect10Game();
});

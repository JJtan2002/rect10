/**
 * Rect10 Game Controller & Application Coordinator (Phase 7)
 * Coordinates:
 * - Landing Page / Main Menu state machine
 * - 4-Slide Interactive Visual Tutorial
 * - Dynamic Grid Sizing: Small (7x10), Medium (9x12), Large (11x15)
 * - Game Modes: 100s Challenge vs Unlimited Free Play (Zen)
 * - Mathematical Engine & Typed Array 2D Prefix Sums
 * - High-DPI Canvas 2D View & Tile Dissolve Animations
 * - Procedural Web Audio Acoustic Synthesizer
 * - Multi-Tier Persistent Leaderboard (Daily, Weekly, All-Time, History per size)
 * - Mobile Haptics Engine (Web Vibration API)
 * - Screen Wake Lock API
 * - Android Hardware Back Button & Browser History Navigation
 */

const GRID_SIZES = {
  small: { cols: 7, rows: 10, minMoves: 10 },
  medium: { cols: 9, rows: 12, minMoves: 15 },
  large: { cols: 11, rows: 15, minMoves: 20 }
};

class Rect10Game {
  constructor() {
    this.selectedMode = 'challenge'; // 'challenge' | 'free'
    this.selectedSize = 'large';      // 'small' | 'medium' | 'large'
    this.activeLbSize = 'large';

    const cfg = GRID_SIZES[this.selectedSize];
    this.engine = new Rect10Engine(cfg.cols, cfg.rows);
    this.audio = new Rect10Audio();
    this.leaderboard = new Rect10Leaderboard();
    this.haptics = new Rect10Haptics();
    this.missions = new Rect10Missions();
    this.skillsUsed = { clairvoyance: false, gravity: false, reset: false };

    // DOM Elements - Screens
    this.landingScreen = document.getElementById('landingScreen');
    this.gameScreen = document.getElementById('gameScreen');

    // DOM Elements - Landing Menu
    this.modeChallengeBtn = document.getElementById('modeChallengeBtn');
    this.modeFreeBtn = document.getElementById('modeFreeBtn');
    this.modeDescription = document.getElementById('modeDescription');
    this.sizeSmallBtn = document.getElementById('sizeSmallBtn');
    this.sizeMediumBtn = document.getElementById('sizeMediumBtn');
    this.sizeLargeBtn = document.getElementById('sizeLargeBtn');
    this.startGameBtn = document.getElementById('startGameBtn');
    this.openTutorialBtn = document.getElementById('openTutorialBtn');
    this.openMissionsBtn = document.getElementById('openMissionsBtn');
    this.openLeaderboardMenuBtn = document.getElementById('openLeaderboardMenuBtn');
    this.landingMuteBtn = document.getElementById('landingMuteBtn');
    this.landingHapticBtn = document.getElementById('landingHapticBtn');

    // DOM Elements - HUD
    this.canvas = document.getElementById('gameCanvas');
    this.boardContainer = document.getElementById('boardContainer');
    this.view = new Rect10View(this.canvas);
    this.homeBtn = document.getElementById('homeBtn');
    this.gameModeBadge = document.getElementById('gameModeBadge');
    this.hudTimerLabel = document.getElementById('hudTimerLabel');
    this.timerEl = document.getElementById('hudTimer');
    this.timerBarFill = document.getElementById('timerBarFill');
    this.scoreEl = document.getElementById('hudScore');
    this.bestScoreEl = document.getElementById('hudBestScore');
    this.muteBtn = document.getElementById('muteBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.leaderboardBtn = document.getElementById('leaderboardBtn');
    this.hapticBtn = document.getElementById('hapticBtn');

    // DOM Elements - Tactical Skills Dock
    this.skillClairvoyanceBtn = document.getElementById('skillClairvoyanceBtn');
    this.skillGravityBtn = document.getElementById('skillGravityBtn');
    this.skillResetBtn = document.getElementById('skillResetBtn');
    this.skillBadgeClairvoyance = document.getElementById('skillBadgeClairvoyance');
    this.skillBadgeGravity = document.getElementById('skillBadgeGravity');
    this.skillBadgeReset = document.getElementById('skillBadgeReset');

    // DOM Elements - Missions Modal
    this.missionsModal = document.getElementById('missionsModal');
    this.closeMissionsBtn = document.getElementById('closeMissionsBtn');
    this.closeMissionsActionBtn = document.getElementById('closeMissionsActionBtn');
    this.careerScoreDisplay = document.getElementById('careerScoreDisplay');
    this.missionsList = document.getElementById('missionsList');

    // DOM Elements - Tutorial Modal
    this.tutorialModal = document.getElementById('tutorialModal');
    this.closeTutorialBtn = document.getElementById('closeTutorialBtn');
    this.tutorialPrevBtn = document.getElementById('tutorialPrevBtn');
    this.tutorialNextBtn = document.getElementById('tutorialNextBtn');
    this.tutorialDoneBtn = document.getElementById('tutorialDoneBtn');
    this.tutorialSlides = Array.from(document.querySelectorAll('.tutorial-slide'));
    this.tutorialDots = Array.from(document.querySelectorAll('.tutorial-dots .dot'));
    this.currentTutorialSlide = 1;

    // DOM Elements - In-Grid Pause Curtain & Modal
    this.pauseCurtain = document.getElementById('pauseCurtain');
    this.pauseModal = document.getElementById('pauseModal');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.modalRestartBtn = document.getElementById('modalRestartBtn');
    this.pauseHomeBtn = document.getElementById('pauseHomeBtn');

    // DOM Elements - Leaderboard Modal
    this.leaderboardModal = document.getElementById('leaderboardModal');
    this.closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    this.closeLeaderboardActionBtn = document.getElementById('closeLeaderboardActionBtn');
    this.lbSizeTabs = Array.from(document.querySelectorAll('.lb-size-tab'));
    this.lbAllTime = document.getElementById('lbAllTime');
    this.lbWeekly = document.getElementById('lbWeekly');
    this.lbDaily = document.getElementById('lbDaily');
    this.lbHistoryList = document.getElementById('lbHistoryList');

    // DOM Elements - Game Over Modal & Badges
    this.gameOverModal = document.getElementById('gameOverModal');
    this.allTimeBestBadge = document.getElementById('allTimeBestBadge');
    this.weeklyBestBadge = document.getElementById('weeklyBestBadge');
    this.dailyBestBadge = document.getElementById('dailyBestBadge');
    this.freeModeNotice = document.getElementById('freeModeNotice');
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
    this.gameOverHomeBtn = document.getElementById('gameOverHomeBtn');

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

    this.highScore = this.leaderboard.getAllTimeBest(this.selectedSize);

    this.updateControlsUI();
    this.bindEvents();
    this.startLoop();
  }

  updateControlsUI() {
    const muteIcon = this.audio.isMuted ? '🔇' : '🔊';
    this.muteBtn.textContent = muteIcon;
    this.landingMuteBtn.textContent = muteIcon;

    this.hapticBtn.textContent = '📳';
    this.landingHapticBtn.textContent = '📳';

    const hapticDisabled = !this.haptics.isEnabled || !this.haptics.isSupported;
    if (hapticDisabled) {
      this.hapticBtn.classList.add('disabled');
      this.landingHapticBtn.classList.add('disabled');
    } else {
      this.hapticBtn.classList.remove('disabled');
      this.landingHapticBtn.classList.remove('disabled');
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
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  // --- Screen Management & Launch ---
  showMenu() {
    this.isPlaying = false;
    this.isPaused = false;
    this.releaseWakeLock();

    this.gameOverModal.classList.remove('active');
    this.pauseModal.classList.remove('active');
    this.leaderboardModal.classList.remove('active');
    this.tutorialModal.classList.remove('active');
    this.pauseCurtain.classList.remove('active');

    this.gameScreen.classList.remove('active');
    this.landingScreen.classList.add('active');
    this.updateControlsUI();
  }

  launchGame(mode = this.selectedMode, size = this.selectedSize) {
    this.selectedMode = mode;
    this.selectedSize = size;
    const cfg = GRID_SIZES[this.selectedSize];

    // Reconfigure Engine and View
    this.engine.setDimensions(cfg.cols, cfg.rows);
    this.view.setDimensions(cfg.cols, cfg.rows);

    // Update board container aspect ratio class
    this.boardContainer.className = `board-container size-${this.selectedSize}`;

    // Mode badge
    if (this.selectedMode === 'free') {
      this.gameModeBadge.textContent = 'Zen';
      this.gameModeBadge.className = 'mode-indicator-badge zen';
      this.hudTimerLabel.textContent = 'Mode';
      this.timerEl.textContent = '∞';
      this.timerBarFill.className = 'timer-bar-fill zen';
    } else {
      this.gameModeBadge.textContent = '100s';
      this.gameModeBadge.className = 'mode-indicator-badge';
      this.hudTimerLabel.textContent = 'Time';
      this.timerEl.textContent = '100';
      this.timerBarFill.className = 'timer-bar-fill';
    }

    // Switch screen visibility
    this.landingScreen.classList.remove('active');
    this.gameScreen.classList.add('active');

    this.startNewGame();
  }

  startNewGame() {
    const cfg = GRID_SIZES[this.selectedSize];
    this.engine.init(null, cfg.minMoves);
    this.timeLeft = this.ROUND_DURATION_SEC;
    this.isPlaying = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.dragState.active = false;
    this.highScore = this.leaderboard.getAllTimeBest(this.selectedSize);

    this.gameOverModal.classList.remove('active');
    this.pauseModal.classList.remove('active');
    this.leaderboardModal.classList.remove('active');
    this.missionsModal.classList.remove('active');
    this.pauseCurtain.classList.remove('active');

    this.skillsUsed = { clairvoyance: false, gravity: false, reset: false };
    this.view.clearHint();
    this.updateSkillsUI();

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

  // --- Tutorial Navigation ---
  openTutorial() {
    this.haptics.buttonTap();
    this.audio.playButtonTick();
    this.setTutorialSlide(1);
    this.tutorialModal.classList.add('active');
    history.pushState({ modal: 'tutorial' }, '');
  }

  closeTutorial() {
    this.tutorialModal.classList.remove('active');
  }

  setTutorialSlide(slideIndex) {
    this.currentTutorialSlide = Math.max(1, Math.min(2, slideIndex));
    this.tutorialSlides.forEach((slide) => {
      const idx = parseInt(slide.getAttribute('data-slide'), 10);
      slide.classList.toggle('active', idx === this.currentTutorialSlide);
    });
    this.tutorialDots.forEach((dot) => {
      const idx = parseInt(dot.getAttribute('data-dot'), 10);
      dot.classList.toggle('active', idx === this.currentTutorialSlide);
    });

    if (this.currentTutorialSlide === 1) {
      this.tutorialPrevBtn.style.display = 'none';
      this.tutorialNextBtn.style.display = 'block';
      this.tutorialDoneBtn.style.display = 'none';
    } else {
      this.tutorialPrevBtn.style.display = 'block';
      this.tutorialNextBtn.style.display = 'none';
      this.tutorialDoneBtn.style.display = 'block';
    }
  }

  // --- Missions Modal ---
  openMissions() {
    this.haptics.buttonTap();
    this.audio.playButtonTick();

    const wasPlaying = this.isPlaying && !this.isPaused;
    if (wasPlaying) {
      this.pauseGame();
    }

    const careerScore = this.missions.getCareerScore();
    this.careerScoreDisplay.textContent = `${Rect10Game.formatScore(careerScore)} PTS`;

    const skills = this.missions.getSkillsProgress();
    this.missionsList.innerHTML = skills.map((skill) => {
      const statusBadge = skill.isUnlocked
        ? `<span class="mission-status-badge unlocked">Unlocked</span>`
        : `<span class="mission-status-badge locked">${Rect10Game.formatScore(skill.requiredScore)} PTS</span>`;

      return `
        <div class="mission-card ${skill.isUnlocked ? 'unlocked' : ''}">
          <div class="mission-card-header">
            <div class="mission-title-group">
              <span class="mission-icon">${skill.icon}</span>
              <span class="mission-name">${skill.name}</span>
            </div>
            ${statusBadge}
          </div>
          <div class="mission-desc">${skill.description}</div>
          <div class="mission-progress-bar-track">
            <div class="mission-progress-bar-fill" style="width: ${skill.pct}%;"></div>
          </div>
          <div class="mission-progress-meta">
            <span>${Rect10Game.formatScore(Math.min(skill.currentScore, skill.requiredScore))} / ${Rect10Game.formatScore(skill.requiredScore)}</span>
            <span>${skill.pct}%</span>
          </div>
        </div>
      `;
    }).join('');

    this.missionsModal.classList.add('active');
    history.pushState({ modal: 'missions' }, '');
  }

  closeMissions() {
    this.missionsModal.classList.remove('active');
  }

  // --- Tactical Skills System ---
  updateSkillsUI() {
    const skills = [
      { id: 'clairvoyance', btn: this.skillClairvoyanceBtn, badge: this.skillBadgeClairvoyance },
      { id: 'gravity', btn: this.skillGravityBtn, badge: this.skillBadgeGravity },
      { id: 'reset', btn: this.skillResetBtn, badge: this.skillBadgeReset }
    ];

    skills.forEach(({ id, btn, badge }) => {
      const isUnlocked = this.missions.isUnlocked(id);
      const isUsed = this.skillsUsed[id];

      btn.classList.remove('ready', 'locked', 'used');

      if (!isUnlocked) {
        btn.classList.add('locked');
        badge.textContent = '🔒';
        btn.title = `Unlocks at ${Rect10Game.formatScore(SKILL_DEFINITIONS[id].requiredScore)} pts in Missions`;
      } else if (isUsed) {
        btn.classList.add('used');
        badge.textContent = '0/1';
        btn.title = 'Already used this round';
      } else {
        btn.classList.add('ready');
        badge.textContent = '1/1';
        btn.title = `Ready: ${SKILL_DEFINITIONS[id].name}`;
      }
    });
  }

  useSkill(skillId) {
    if (!this.isPlaying || this.isPaused) return;
    if (!this.missions.isUnlocked(skillId)) {
      this.openMissions();
      return;
    }
    if (this.skillsUsed[skillId]) return;

    if (skillId === 'clairvoyance') {
      const hint = this.engine.getHintMove();
      if (!hint) {
        this.endGame('No More Moves!');
        return;
      }
      this.view.setHint(hint.r1, hint.c1, hint.r2, hint.c2);
      this.audio.playClairvoyanceChime();
      this.haptics.buttonTap();
      this.skillsUsed.clairvoyance = true;
      this.updateSkillsUI();
    } else if (skillId === 'gravity') {
      const grav = this.engine.applyGravity();
      this.audio.playGravityWhoosh();
      this.haptics.buttonTap();
      this.view.clearHint();
      this.skillsUsed.gravity = true;
      this.updateSkillsUI();
      this.updateHUD();
      if (grav.isDeadlocked) {
        this.endGame('No More Moves!');
      }
    } else if (skillId === 'reset') {
      const rst = this.engine.applyReset();
      this.audio.playResetShuffle();
      this.haptics.buttonTap();
      this.view.clearHint();
      this.skillsUsed.reset = true;
      this.updateSkillsUI();
      this.updateHUD();
      if (rst.isDeadlocked) {
        this.endGame('No More Moves!');
      }
    }
  }

  // --- Leaderboard Modal & Filtering ---
  openLeaderboard(size = this.selectedSize) {
    this.haptics.buttonTap();
    this.audio.playButtonTick();

    const wasPlaying = this.isPlaying && !this.isPaused;
    if (wasPlaying) {
      this.pauseGame();
    }

    this.setLeaderboardSizeTab(size);
    this.leaderboardModal.classList.add('active');
    history.pushState({ modal: 'leaderboard' }, '');
  }

  setLeaderboardSizeTab(size) {
    this.activeLbSize = size;
    this.lbSizeTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-size') === size);
    });

    this.lbAllTime.textContent = Rect10Game.formatScore(this.leaderboard.getAllTimeBest(size));
    this.lbWeekly.textContent = Rect10Game.formatScore(this.leaderboard.getWeeklyBest(size));
    this.lbDaily.textContent = Rect10Game.formatScore(this.leaderboard.getTodayBest(size));

    const history = this.leaderboard.getHistory(size);
    if (history.length === 0) {
      this.lbHistoryList.innerHTML = `<div class="history-empty">No ${size} challenge runs completed yet.</div>`;
    } else {
      this.lbHistoryList.innerHTML = history.map((item) => {
        const d = new Date(item.timestamp);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${Rect10Leaderboard.pad(d.getHours())}:${Rect10Leaderboard.pad(d.getMinutes())}`;
        return `
          <div class="history-item">
            <span class="history-date">${dateStr}</span>
            <div class="history-right">
              <span class="history-rank">${item.rank}</span>
              <span class="history-score">${Rect10Game.formatScore(item.score)} pts</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  closeLeaderboard() {
    this.leaderboardModal.classList.remove('active');
  }

  static formatScore(score) {
    if (typeof score !== 'number' || isNaN(score)) return '0';
    if (score >= 1000000) {
      const m = score / 1000000;
      return `${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1))}m`;
    }
    if (score >= 10000) {
      const k = score / 1000;
      const formatted = (k % 1 === 0) ? k.toFixed(0) : k.toFixed(1);
      return `${formatted}k`;
    }
    return score.toString();
  }

  calculateRank(score) {
    if (score >= 8000) return 'Grandmaster';
    if (score >= 6000) return 'Master';
    if (score >= 4000) return 'Tactician';
    if (score >= 2000) return 'Calculator';
    return 'Novice';
  }

  bindEvents() {
    // --- Landing Screen Selectors ---
    this.modeChallengeBtn.addEventListener('click', () => {
      this.selectedMode = 'challenge';
      this.modeChallengeBtn.classList.add('active');
      this.modeFreeBtn.classList.remove('active');
      this.modeDescription.textContent = 'Race against the 100s clock, earn rank badges, and log daily/weekly records.';
      this.haptics.buttonTap();
      this.audio.playButtonTick();
    });

    this.modeFreeBtn.addEventListener('click', () => {
      this.selectedMode = 'free';
      this.modeFreeBtn.classList.add('active');
      this.modeChallengeBtn.classList.remove('active');
      this.modeDescription.textContent = 'Unlimited time until no moves remain. Perfect for practicing tactics (no high score logging).';
      this.haptics.buttonTap();
      this.audio.playButtonTick();
    });

    const sizeBtns = [
      { el: this.sizeSmallBtn, size: 'small' },
      { el: this.sizeMediumBtn, size: 'medium' },
      { el: this.sizeLargeBtn, size: 'large' }
    ];

    sizeBtns.forEach(({ el, size }) => {
      el.addEventListener('click', () => {
        this.selectedSize = size;
        sizeBtns.forEach(b => b.el.classList.toggle('active', b.size === size));
        this.haptics.buttonTap();
        this.audio.playButtonTick();
      });
    });

    this.startGameBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.launchGame(this.selectedMode, this.selectedSize);
    });

    this.openTutorialBtn.addEventListener('click', () => this.openTutorial());
    this.openMissionsBtn.addEventListener('click', () => this.openMissions());
    this.openLeaderboardMenuBtn.addEventListener('click', () => this.openLeaderboard(this.selectedSize));

    this.landingMuteBtn.addEventListener('click', () => {
      this.audio.toggleMute();
      this.updateControlsUI();
      this.haptics.buttonTap();
    });

    this.landingHapticBtn.addEventListener('click', () => {
      this.haptics.toggle();
      this.updateControlsUI();
    });

    // --- Tutorial Events ---
    this.closeTutorialBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeTutorial();
    });

    this.tutorialNextBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.setTutorialSlide(this.currentTutorialSlide + 1);
    });

    this.tutorialPrevBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.setTutorialSlide(this.currentTutorialSlide - 1);
    });

    this.tutorialDoneBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeTutorial();
    });

    this.tutorialDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const slideIdx = parseInt(dot.getAttribute('data-dot'), 10);
        this.setTutorialSlide(slideIdx);
      });
    });

    // --- Missions Events ---
    this.closeMissionsBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeMissions();
    });

    this.closeMissionsActionBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.closeMissions();
    });

    // --- Tactical Skills Events ---
    this.skillClairvoyanceBtn.addEventListener('click', () => this.useSkill('clairvoyance'));
    this.skillGravityBtn.addEventListener('click', () => this.useSkill('gravity'));
    this.skillResetBtn.addEventListener('click', () => this.useSkill('reset'));

    // --- In-Game Header & Controls ---
    this.homeBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.showMenu();
    });

    this.pauseHomeBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.showMenu();
    });

    this.gameOverHomeBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      this.audio.playButtonTick();
      this.showMenu();
    });

    this.lbSizeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const size = tab.getAttribute('data-size');
        this.setLeaderboardSizeTab(size);
        this.haptics.buttonTap();
        this.audio.playButtonTick();
      });
    });

    // --- In-Game Canvas Pointer Mechanics ---
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
        this.view.clearHint();
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

        if (this.selectedMode === 'challenge') {
          if (this.engine.score > this.highScore) {
            this.highScore = this.engine.score;
          }
        }

        this.updateHUD();

        if (res.isDeadlocked) {
          this.endGame('No More Moves!');
        }
      }
    };

    // Pointer Events
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

    // Mouse Fallbacks
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

    // Touch Fallbacks
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

    // Header buttons
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
      this.audio.toggleMute();
      this.updateControlsUI();
      this.haptics.buttonTap();
    });

    this.hapticBtn.addEventListener('click', () => {
      this.haptics.toggle();
      this.updateControlsUI();
    });

    this.leaderboardBtn.addEventListener('click', () => {
      this.openLeaderboard(this.selectedSize);
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

    // Copy Results
    this.copyStatsBtn.addEventListener('click', () => {
      this.haptics.buttonTap();
      const score = this.engine.score;
      const rank = this.calculateRank(score);
      const b = this.engine.clearSizeBreakdown;
      const multi = (b[4] || 0) + (b[5] || 0) + (b['6+'] || 0);
      const modeLabel = this.selectedMode === 'free' ? 'Zen Free Play' : '100s Challenge';
      const text = `🎯 Rect10 [${this.selectedSize.toUpperCase()} | ${modeLabel}]: ${Rect10Game.formatScore(score)} pts (${rank})\n⏱️ Clears: ${this.engine.clearsCount} | Largest: ${this.engine.largestClear} blocks\n🧩 2c: ${b[2] || 0} | 3c: ${b[3] || 0} | 4c+: ${multi}`;
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.copyStatsBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            this.copyStatsBtn.textContent = '📋 Copy Result';
          }, 1500);
        });
      }
    });

    // Popstate Android Back Button Navigation
    window.addEventListener('popstate', () => {
      if (this.tutorialModal.classList.contains('active')) {
        this.closeTutorial();
      } else if (this.missionsModal.classList.contains('active')) {
        this.closeMissions();
      } else if (this.leaderboardModal.classList.contains('active')) {
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
        if (this.tutorialModal.classList.contains('active')) {
          this.closeTutorial();
        } else if (this.missionsModal.classList.contains('active')) {
          this.closeMissions();
        } else if (this.leaderboardModal.classList.contains('active')) {
          this.closeLeaderboard();
        } else if (this.isPaused) {
          this.resumeGame();
        } else if (this.isPlaying) {
          this.pauseGame();
        }
      } else if ((e.code === 'Space' || e.code === 'Enter') && !this.isPlaying && !this.leaderboardModal.classList.contains('active') && !this.tutorialModal.classList.contains('active') && !this.missionsModal.classList.contains('active')) {
        e.preventDefault();
        if (this.landingScreen.classList.contains('active')) {
          this.launchGame();
        } else {
          this.startNewGame();
        }
      }
    });

    // Visibility & Window Blur
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
    if (this.selectedMode === 'free') {
      this.timerEl.textContent = '∞';
    } else {
      this.timerEl.textContent = Math.ceil(this.timeLeft).toString();
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

    this.scoreEl.textContent = Rect10Game.formatScore(this.engine.score);

    if (this.selectedMode === 'free') {
      this.bestScoreEl.textContent = '—';
    } else {
      this.bestScoreEl.textContent = Rect10Game.formatScore(this.leaderboard.getAllTimeBest(this.selectedSize));
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
    this.modalScore.textContent = Rect10Game.formatScore(score);
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

    this.allTimeBestBadge.classList.remove('active');
    this.weeklyBestBadge.classList.remove('active');
    this.dailyBestBadge.classList.remove('active');

    if (this.selectedMode === 'free') {
      // Free Mode: do not log high scores
      this.freeModeNotice.style.display = 'block';
      this.audio.playGameOverTone();
      this.haptics.gameOver();
    } else {
      // Challenge Mode: record score to leaderboard for current size
      this.freeModeNotice.style.display = 'none';
      const milestones = this.leaderboard.recordScore(score, {
        mode: 'challenge',
        size: this.selectedSize,
        rank,
        clearsCount: this.engine.clearsCount,
        cellsClearedTotal: this.engine.cellsClearedTotal,
        largestClear: this.engine.largestClear,
        paceCPM: cpm
      });

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

      this.highScore = this.leaderboard.getAllTimeBest(this.selectedSize);
      this.missions.addCareerScore(score);
    }

    this.view.clearHint();
    this.updateSkillsUI();
    this.updateHUD();
    this.gameOverModal.classList.add('active');
    history.pushState({ modal: 'gameover' }, '');
  }

  startLoop() {
    const loop = (currentTime) => {
      const deltaSec = Math.min(0.1, (currentTime - this.lastFrameTime) / 1000);
      this.lastFrameTime = currentTime;

      if (this.isPlaying && !this.isPaused) {
        if (this.selectedMode === 'challenge') {
          this.timeLeft -= deltaSec;
          if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.updateHUD();
            this.endGame("Time's Up!");
          } else {
            this.updateHUD();
          }
        }
      }

      if (this.gameScreen.classList.contains('active')) {
        this.view.render(this.engine, this.dragState);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Rect10Game();
});

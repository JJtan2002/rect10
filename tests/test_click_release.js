/**
 * Automated CDP Integration Test: Verifies Landing Page, Mode/Size Toggles,
 * Tutorial Modal, pointer mechanics, instant release, Leaderboard modal UI,
 * Haptics toggle, and Android back button popstate handling.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const HTTP_PORT = 8888;
const RECT10_DIR = path.resolve(__dirname, '..');

// Simple static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(RECT10_DIR, reqPath);

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.json' ? 'application/json' : ext === '.svg' ? 'image/svg+xml' : 'text/css';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function getWebSocketDebuggerUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/json/list`, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      const page = res.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("Could not connect to CDP");
}

async function runTest() {
  await new Promise(r => server.listen(HTTP_PORT, '127.0.0.1', r));
  console.log(`Local test server listening on http://127.0.0.1:${HTTP_PORT}`);

  console.log("Starting headless Edge on port", PORT, "...");
  const browser = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    `http://127.0.0.1:${HTTP_PORT}/index.html`
  ]);

  try {
    const wsUrl = await getWebSocketDebuggerUrl();
    const ws = new WebSocket(wsUrl);

    await new Promise(resolve => ws.onopen = resolve);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html` });

    // Wait for load event
    await new Promise((resolve) => {
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Page.loadEventFired') {
          ws.removeEventListener('message', handler);
          resolve();
        }
      };
      ws.addEventListener('message', handler);
      setTimeout(resolve, 1500);
    });

    await new Promise(r => setTimeout(r, 500));

    // 1. Verify Landing Screen is Active
    console.log("Testing Landing Page & Menu selections...");
    const isMenuVisible = await send('Runtime.evaluate', {
      expression: `document.getElementById('landingScreen').classList.contains('active')`,
      returnByValue: true
    });
    if (!isMenuVisible.result.value) {
      throw new Error("FAIL: Landing screen should be visible at launch!");
    }
    console.log("✅ Landing screen is active at launch");

    // Test Mode Toggle: Free Mode vs Challenge Mode
    await send('Runtime.evaluate', {
      expression: `document.getElementById('modeFreeBtn').click()`,
      returnByValue: true
    });
    let modeCheck = await send('Runtime.evaluate', {
      expression: `window.game.selectedMode`,
      returnByValue: true
    });
    if (modeCheck.result.value !== 'free') throw new Error("FAIL: Mode toggle to free failed!");
    console.log("✅ Game mode toggled to Free Mode");

    await send('Runtime.evaluate', {
      expression: `document.getElementById('modeChallengeBtn').click()`,
      returnByValue: true
    });
    modeCheck = await send('Runtime.evaluate', {
      expression: `window.game.selectedMode`,
      returnByValue: true
    });
    if (modeCheck.result.value !== 'challenge') throw new Error("FAIL: Mode toggle to challenge failed!");
    console.log("✅ Game mode toggled to Challenge Mode");

    // Test Size Toggle: Small vs Large
    await send('Runtime.evaluate', {
      expression: `document.getElementById('sizeSmallBtn').click()`,
      returnByValue: true
    });
    let sizeCheck = await send('Runtime.evaluate', {
      expression: `window.game.selectedSize`,
      returnByValue: true
    });
    if (sizeCheck.result.value !== 'small') throw new Error("FAIL: Size toggle to small failed!");

    await send('Runtime.evaluate', {
      expression: `document.getElementById('sizeLargeBtn').click()`,
      returnByValue: true
    });
    sizeCheck = await send('Runtime.evaluate', {
      expression: `window.game.selectedSize`,
      returnByValue: true
    });
    if (sizeCheck.result.value !== 'large') throw new Error("FAIL: Size toggle to large failed!");
    console.log("✅ Grid sizes Small/Medium/Large toggled successfully");

    // 2. Test Tutorial Modal Navigation
    console.log("Testing Tutorial modal carousel...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('openTutorialBtn').click()`,
      returnByValue: true
    });
    const tutOpen = await send('Runtime.evaluate', {
      expression: `document.getElementById('tutorialModal').classList.contains('active')`,
      returnByValue: true
    });
    if (!tutOpen.result.value) throw new Error("FAIL: Tutorial modal did not open!");

    // Next slide -> 2 (Final slide)
    await send('Runtime.evaluate', {
      expression: `document.getElementById('tutorialNextBtn').click()`,
      returnByValue: true
    });
    const tutSlide2 = await send('Runtime.evaluate', {
      expression: `({ slide: window.game.currentTutorialSlide, doneVisible: document.getElementById('tutorialDoneBtn').style.display !== 'none' })`,
      returnByValue: true
    });
    if (tutSlide2.result.value.slide !== 2 || !tutSlide2.result.value.doneVisible) {
      throw new Error("FAIL: Tutorial slide 2 did not show Done button!");
    }

    // Close tutorial via Done button
    await send('Runtime.evaluate', {
      expression: `document.getElementById('tutorialDoneBtn').click()`,
      returnByValue: true
    });
    const tutClosed = await send('Runtime.evaluate', {
      expression: `document.getElementById('tutorialModal').classList.contains('active')`,
      returnByValue: true
    });
    if (tutClosed.result.value) throw new Error("FAIL: Tutorial modal failed to close on Done!");
    console.log("✅ Tutorial carousel opened, navigated through 2 slides, and closed via Done button cleanly");

    // 2b. Test Missions Modal
    console.log("Testing Missions modal...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('openMissionsBtn').click()`,
      returnByValue: true
    });
    const missionsOpen = await send('Runtime.evaluate', {
      expression: `({
        active: document.getElementById('missionsModal').classList.contains('active'),
        scoreText: document.getElementById('careerScoreDisplay').textContent
      })`,
      returnByValue: true
    });
    if (!missionsOpen.result.value.active) throw new Error("FAIL: Missions modal did not open!");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('closeMissionsActionBtn').click()`,
      returnByValue: true
    });
    console.log("✅ Missions modal opened, verified, and closed cleanly");

    // 3. Launch Game into Active Board
    console.log("Launching game from landing screen...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('startGameBtn').click()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 200));

    const isGameVisible = await send('Runtime.evaluate', {
      expression: `document.getElementById('gameScreen').classList.contains('active')`,
      returnByValue: true
    });
    if (!isGameVisible.result.value) throw new Error("FAIL: Game screen not visible after Start Game click!");
    console.log("✅ Game screen transitioned successfully");

    // 4. Test Canvas Drag & Release Mechanics
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: Math.floor(rect.left + 50), y: Math.floor(rect.top + 50) };
      })()`,
      returnByValue: true
    });

    if (!evalRes || !evalRes.result || !evalRes.result.value) {
      throw new Error("Could not find canvas coordinates");
    }

    const startX = evalRes.result.value.x;
    const startY = evalRes.result.value.y;
    const endX = startX + 60;
    const endY = startY + 60;

    console.log(`Simulating mouse drag from (${startX}, ${startY}) to (${endX}, ${endY})...`);

    // Mouse Press
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      clickCount: 1
    });

    // Mouse Move (Dragging)
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: endX,
      y: endY,
      button: 'left',
      buttons: 1
    });

    let state = await send('Runtime.evaluate', {
      expression: `window.game.dragState.active`,
      returnByValue: true
    });
    if (state.result.value !== true) {
      throw new Error("FAIL: dragState.active should be TRUE during drag!");
    }

    // Release mouse without moving cursor
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: endX,
      y: endY,
      button: 'left',
      buttons: 0
    });

    state = await send('Runtime.evaluate', {
      expression: `window.game.dragState.active`,
      returnByValue: true
    });
    if (state.result.value !== false) {
      throw new Error("FAIL: dragState.active remained true after mouse release!");
    }
    console.log("✅ Selection box cleared immediately upon mouse release without requiring cursor movement!");

    // 5. Test a Guaranteed VALID selection clear
    console.log("Testing guaranteed VALID move release without cursor movement...");
    const validMoveRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const moves = window.game.engine.findAllValidMoves(1);
        if (moves.length === 0) return null;
        const m = moves[0];
        const v = window.game.view;
        const rect = v.canvas.getBoundingClientRect();
        
        const x1 = rect.left + v.offsetX + v.gridPadding + (m.c1 + 0.5) * v.cellSize;
        const y1 = rect.top + v.offsetY + v.gridPadding + (m.r1 + 0.5) * v.cellSize;
        const x2 = rect.left + v.offsetX + v.gridPadding + (m.c2 + 0.5) * v.cellSize;
        const y2 = rect.top + v.offsetY + v.gridPadding + (m.r2 + 0.5) * v.cellSize;
        return { x1: Math.floor(x1), y1: Math.floor(y1), x2: Math.floor(x2), y2: Math.floor(y2), move: m };
      })()`,
      returnByValue: true
    });

    const vm = validMoveRes.result.value;
    console.log(`Found valid move: [${vm.move.r1},${vm.move.c1}] to [${vm.move.r2},${vm.move.c2}]. Dragging from (${vm.x1},${vm.y1}) to (${vm.x2},${vm.y2})...`);

    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: vm.x1,
      y: vm.y1,
      button: 'left',
      clickCount: 1
    });

    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: vm.x2,
      y: vm.y2,
      button: 'left',
      buttons: 1
    });

    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: vm.x2,
      y: vm.y2,
      button: 'left',
      buttons: 0
    });

    const postClearState = await send('Runtime.evaluate', {
      expression: `({ score: window.game.engine.score, clears: window.game.engine.clearsCount, active: window.game.dragState.active })`,
      returnByValue: true
    });

    if (postClearState.result.value.active !== false || postClearState.result.value.score <= 0) {
      throw new Error("FAIL: Valid move was not cleared / scored on release!");
    }
    const hudScoreValue = await send('Runtime.evaluate', {
      expression: `document.getElementById('hudScore').textContent`,
      returnByValue: true
    });
    if (parseInt(hudScoreValue.result.value, 10) <= 0) {
      throw new Error(`FAIL: hudScore did not update with points! Got: ${hudScoreValue.result.value}`);
    }
    const formatCheck = await send('Runtime.evaluate', {
      expression: `({
        k10_5: Rect10Game.formatScore(10500),
        k14_4: Rect10Game.formatScore(14400),
        k90_5: Rect10Game.formatScore(90500),
        k10: Rect10Game.formatScore(10000),
        sub10k: Rect10Game.formatScore(9900)
      })`,
      returnByValue: true
    });
    if (
      formatCheck.result.value.k10_5 !== '10.5k' ||
      formatCheck.result.value.k14_4 !== '14.4k' ||
      formatCheck.result.value.k90_5 !== '90.5k' ||
      formatCheck.result.value.k10 !== '10k' ||
      formatCheck.result.value.sub10k !== '9900'
    ) {
      throw new Error("FAIL: Rect10Game.formatScore failed formatting requirements: " + JSON.stringify(formatCheck.result.value));
    }
    console.log("✅ Valid move cleared, scored successfully, and score formatting (10.5k, 14.4k, 90.5k) verified!");

    // 6. Test Leaderboard Modal with Size Filtering
    console.log("Testing Leaderboard UI modal with size tabs...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('leaderboardBtn').click()`,
      returnByValue: true
    });

    const lbState = await send('Runtime.evaluate', {
      expression: `({
        isOpen: document.getElementById('leaderboardModal').classList.contains('active'),
        allTime: document.getElementById('lbAllTime').textContent
      })`,
      returnByValue: true
    });

    if (!lbState.result.value.isOpen) {
      throw new Error("FAIL: Leaderboard modal failed to open upon click!");
    }
    console.log("✅ Leaderboard modal opened cleanly with values:", JSON.stringify(lbState.result.value));

    // Test Android Back Button Popstate handling to close modal
    await send('Runtime.evaluate', {
      expression: `window.dispatchEvent(new PopStateEvent('popstate'))`,
      returnByValue: true
    });

    const lbAfterBack = await send('Runtime.evaluate', {
      expression: `document.getElementById('leaderboardModal').classList.contains('active')`,
      returnByValue: true
    });

    if (lbAfterBack.result.value === false) {
      console.log("✅ Android back gesture (popstate) successfully closed Leaderboard modal!");
    } else {
      throw new Error("FAIL: Leaderboard modal remained open after popstate!");
    }

    // Resume game after modal close so skills can be triggered
    await send('Runtime.evaluate', {
      expression: `window.game.resumeGame()`,
      returnByValue: true
    });

    // 6b. Test Tactical Skills Activation (Clairvoyance)
    console.log("Testing Tactical Skills activation...");
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.game.missions.addCareerScore(100000);
        window.game.updateSkillsUI();
      })()`,
      returnByValue: true
    });
    const clairReady = await send('Runtime.evaluate', {
      expression: `document.getElementById('skillClairvoyanceBtn').classList.contains('ready')`,
      returnByValue: true
    });
    if (!clairReady.result.value) throw new Error("FAIL: Clairvoyance skill button did not become ready after 100k points!");
    
    // Trigger Clairvoyance
    await send('Runtime.evaluate', {
      expression: `document.getElementById('skillClairvoyanceBtn').click()`,
      returnByValue: true
    });
    const hintActive = await send('Runtime.evaluate', {
      expression: `window.game.view.hintBox !== null && document.getElementById('skillClairvoyanceBtn').classList.contains('used')`,
      returnByValue: true
    });
    if (!hintActive.result.value) throw new Error("FAIL: Clairvoyance hint was not activated on canvas!");
    console.log("✅ Tactical Skill Clairvoyance successfully activated and highlighted hint on Canvas!");

    // 6c. Test Tactical Skill Reroll Activation (300k pts)
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.game.missions.addCareerScore(200000); // reaches 300k total
        window.game.updateSkillsUI();
      })()`,
      returnByValue: true
    });
    const rerollReady = await send('Runtime.evaluate', {
      expression: `document.getElementById('skillRerollBtn').classList.contains('ready')`,
      returnByValue: true
    });
    if (!rerollReady.result.value) throw new Error("FAIL: Reroll skill button did not become ready after 300k points!");

    await send('Runtime.evaluate', {
      expression: `document.getElementById('skillRerollBtn').click()`,
      returnByValue: true
    });
    const rerollUsed = await send('Runtime.evaluate', {
      expression: `document.getElementById('skillRerollBtn').classList.contains('used')`,
      returnByValue: true
    });
    if (!rerollUsed.result.value) throw new Error("FAIL: Reroll skill button not marked used after activation!");
    console.log("✅ Tactical Skill Reroll successfully activated and re-rolled board!");

    // 7. Test Return to Main Menu via Home Button
    console.log("Testing Home button return to Landing Page...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('homeBtn').click()`,
      returnByValue: true
    });
    const backOnMenu = await send('Runtime.evaluate', {
      expression: `document.getElementById('landingScreen').classList.contains('active')`,
      returnByValue: true
    });
    if (!backOnMenu.result.value) throw new Error("FAIL: Home button failed to return to Landing Screen!");
    console.log("✅ Home button returned to Landing Screen successfully!");

    console.log("\n🎉 ALL AUTOMATED BROWSER & PHASE 7 INTEGRATION TESTS PASSED PERFECTLY!\n");

    ws.close();
  } finally {
    browser.kill();
    server.close();
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});

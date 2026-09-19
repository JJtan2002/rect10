/**
 * Automated CDP Integration Test: Verifies pointer mechanics, instant release,
 * Leaderboard modal UI, Haptics toggle, and Android back button popstate handling.
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
      setTimeout(resolve, 1500); // Fallback timeout
    });

    await new Promise(r => setTimeout(r, 500));

    // 1. Check DOM & Canvas bounding box
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

    // Verify dragState.active is TRUE during drag
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

    // Check dragState.active immediately after release
    state = await send('Runtime.evaluate', {
      expression: `window.game.dragState.active`,
      returnByValue: true
    });

    if (state.result.value === false) {
      console.log("✅ Selection box cleared immediately upon mouse release without requiring cursor movement!");
    } else {
      throw new Error("FAIL: dragState.active remained true after mouse release!");
    }

    // 2. Test a VALID selection clear
    console.log("\nTesting a guaranteed VALID move release without cursor movement...");
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

    if (postClearState.result.value.active !== false) {
      throw new Error("FAIL: Selection box remained active after valid release!");
    }
    if (postClearState.result.value.score <= 0 || postClearState.result.value.clears <= 0) {
      throw new Error("FAIL: Valid move was not cleared / scored on release!");
    }
    console.log("✅ Valid move cleared and scored successfully on release with zero cursor movement!");

    // 3. Test Leaderboard Modal Opening & Closing
    console.log("\nTesting Leaderboard UI modal...");
    await send('Runtime.evaluate', {
      expression: `document.getElementById('leaderboardBtn').click()`,
      returnByValue: true
    });

    const lbState = await send('Runtime.evaluate', {
      expression: `({
        isOpen: document.getElementById('leaderboardModal').classList.contains('active'),
        allTime: document.getElementById('lbAllTime').textContent,
        weekly: document.getElementById('lbWeekly').textContent,
        daily: document.getElementById('lbDaily').textContent
      })`,
      returnByValue: true
    });

    if (!lbState.result.value.isOpen) {
      throw new Error("FAIL: Leaderboard modal failed to open upon click!");
    }
    console.log("✅ Leaderboard modal opened cleanly with values:", JSON.stringify(lbState.result.value));

    // Test Android Back Button Popstate handling to close modal
    console.log("Testing Android back button (popstate) dismissing modal...");
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

    // 4. Test Haptics Toggle
    console.log("\nTesting Haptics toggle button...");
    const hapticBefore = await send('Runtime.evaluate', {
      expression: `window.game.haptics.isEnabled`,
      returnByValue: true
    });

    await send('Runtime.evaluate', {
      expression: `document.getElementById('hapticBtn').click()`,
      returnByValue: true
    });

    const hapticAfter = await send('Runtime.evaluate', {
      expression: `window.game.haptics.isEnabled`,
      returnByValue: true
    });

    if (hapticAfter.result.value !== !hapticBefore.result.value) {
      throw new Error("FAIL: Haptic state did not toggle!");
    }
    console.log("✅ Haptic feedback toggled successfully!");

    console.log("\n🎉 ALL AUTOMATED BROWSER & NATIVE INTEGRATION TESTS PASSED PERFECTLY!\n");

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

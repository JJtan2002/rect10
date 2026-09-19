/**
 * Rect10 Store Asset & Launcher Mipmap Generator
 * 
 * Uses headless Edge via Chrome DevTools Protocol (CDP) to programmatically render:
 * 1. Google Play Store High-Res Icon (512x512 PNG)
 * 2. Google Play Store Feature Graphic (1024x500 PNG)
 * 3. 4 High-Resolution Mobile Screenshots (1080x2400 PNG)
 * 4. Android Launcher Mipmaps (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const HTTP_PORT = 8889;
const ROOT_DIR = path.resolve(__dirname, '..');
const STORE_DIR = path.join(ROOT_DIR, 'store');
const SCREENSHOTS_DIR = path.join(STORE_DIR, 'screenshots');
const RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

// Ensure output folders exist
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Feature Graphic HTML template
const FEATURE_GRAPHIC_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1024px;
      height: 500px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 75% 30%, #1e2a4a 0%, #0c1220 55%, #060911 100%);
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 60px;
      position: relative;
    }
    /* Subtle background grid pattern */
    .bg-digits {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: grid;
      grid-template-columns: repeat(20, 1fr);
      grid-template-rows: repeat(10, 1fr);
      opacity: 0.045;
      font-size: 28px;
      font-weight: 900;
      color: #38bdf8;
      pointer-events: none;
      align-items: center;
      justify-items: center;
    }
    .left-hero {
      z-index: 2;
      max-width: 530px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      box-shadow: 0 8px 24px rgba(56, 189, 248, 0.4);
    }
    .logo-text {
      font-size: 52px;
      font-weight: 900;
      letter-spacing: -1.5px;
      background: linear-gradient(135deg, #ffffff 0%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
    }
    .tagline-sub {
      font-size: 22px;
      font-weight: 700;
      color: #93c5fd;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .hero-desc {
      font-size: 16px;
      line-height: 1.5;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(30, 41, 66, 0.7);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 100px;
      font-size: 13px;
      font-weight: 700;
      color: #e2e8f0;
      backdrop-filter: blur(8px);
    }
    .pill.gold {
      border-color: rgba(250, 204, 21, 0.4);
      color: #fef08a;
    }
    .right-showcase {
      z-index: 2;
      position: relative;
    }
    /* Sleek Puzzle Visual Card */
    .puzzle-card {
      width: 320px;
      background: rgba(19, 27, 46, 0.85);
      border: 1px solid #2a3756;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.2);
      position: relative;
    }
    .mock-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .mock-cell {
      height: 52px;
      background: #1e2942;
      border: 1px solid #334155;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 900;
      color: #64748b;
    }
    /* Highlighted selection box enclosing 1, 2, 3, 4 */
    .mock-cell.active-sel {
      background: rgba(56, 189, 248, 0.2);
      border: 2px solid #38bdf8;
      color: #ffffff;
      box-shadow: 0 0 16px rgba(56, 189, 248, 0.5);
    }
    .badge-sum {
      position: absolute;
      top: 92px;
      left: 110px;
      background: linear-gradient(135deg, #facc15, #f59e0b);
      color: #0f172a;
      font-weight: 900;
      font-size: 16px;
      padding: 6px 14px;
      border-radius: 20px;
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.6);
      border: 2px solid #ffffff;
      transform: rotate(-4deg);
    }
    .floating-points {
      position: absolute;
      bottom: -16px;
      right: -10px;
      background: #10b981;
      color: #ffffff;
      font-weight: 800;
      font-size: 14px;
      padding: 6px 12px;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.5);
    }
  </style>
</head>
<body>
  <div class="bg-digits" id="bgDigits"></div>

  <div class="left-hero">
    <div class="brand-row">
      <img src="icon.svg" class="icon-badge" alt="Rect10">
      <h1 class="logo-text">Rect10</h1>
    </div>
    <div class="tagline-sub">Draw Rectangles. Sum to 10.</div>
    <p class="hero-desc">
      A sleek, tactile arithmetic puzzle designed for pure mental flow.
      Connect pairs, trios, and multi-tile blocks to clear the board!
    </p>
    <div class="pills-row">
      <div class="pill">⚡ 100s Challenge</div>
      <div class="pill">🧘 Zen Free Play</div>
      <div class="pill gold">👁️ Tactical Powers</div>
      <div class="pill">🛡️ 100% Offline • Zero Ads</div>
    </div>
  </div>

  <div class="right-showcase">
    <div class="puzzle-card">
      <div class="mock-grid">
        <div class="mock-cell">8</div>
        <div class="mock-cell active-sel">1</div>
        <div class="mock-cell active-sel">2</div>
        <div class="mock-cell">6</div>
        
        <div class="mock-cell">7</div>
        <div class="mock-cell active-sel">3</div>
        <div class="mock-cell active-sel">4</div>
        <div class="mock-cell">9</div>

        <div class="mock-cell">5</div>
        <div class="mock-cell">1</div>
        <div class="mock-cell">8</div>
        <div class="mock-cell">2</div>
      </div>
      <div class="badge-sum">= 10 ✨</div>
      <div class="floating-points">+400 PTS</div>
    </div>
  </div>

  <script>
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const container = document.getElementById('bgDigits');
    for (let i = 0; i < 200; i++) {
      const el = document.createElement('div');
      el.textContent = digits[Math.floor(Math.random() * digits.length)];
      container.appendChild(el);
    }
  </script>
</body>
</html>
`;

// Icon HTML wrapper for perfect pixel rendering
function getIconHtml(dimension) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${dimension}px;
      height: ${dimension}px;
      overflow: hidden;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <img src="icon.svg">
</body>
</html>
`;
}

// Static web server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/feature-graphic.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(FEATURE_GRAPHIC_HTML);
    return;
  }
  if (reqPath.startsWith('/icon-render-')) {
    const dim = parseInt(reqPath.replace('/icon-render-', '').replace('.html', ''), 10);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getIconHtml(dim));
    return;
  }
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(ROOT_DIR, reqPath);
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

async function run() {
  await new Promise(r => server.listen(HTTP_PORT, '127.0.0.1', r));
  console.log(`Local asset server active on http://127.0.0.1:${HTTP_PORT}`);

  console.log("Launching headless Edge for asset rendering...");
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

    async function navigateTo(url) {
      await send('Page.navigate', { url });
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
      await new Promise(r => setTimeout(r, 300));
    }

    async function captureImage(outputPath, width, height) {
      const res = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width, height, scale: 1 }
      });
      fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
      const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
      console.log(`  ✓ Generated ${path.basename(outputPath)} (${width}x${height}, ${sizeKB} KB)`);
    }

    console.log("\n=== 1. Generating Google Play High-Res Icon (512x512) ===");
    await send('Emulation.setDeviceMetricsOverride', {
      width: 512,
      height: 512,
      deviceScaleFactor: 1,
      mobile: false
    });
    await navigateTo(`http://127.0.0.1:${HTTP_PORT}/icon-render-512.html`);
    await captureImage(path.join(STORE_DIR, 'icon-512.png'), 512, 512);

    console.log("\n=== 2. Generating Google Play Feature Graphic (1024x500) ===");
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 500,
      deviceScaleFactor: 1,
      mobile: false
    });
    await navigateTo(`http://127.0.0.1:${HTTP_PORT}/feature-graphic.html`);
    await captureImage(path.join(STORE_DIR, 'feature-graphic.png'), 1024, 500);

    console.log("\n=== 3. Generating Android Launcher Mipmaps ===");
    const MIPMAP_CONFIG = [
      { folder: 'mipmap-mdpi', size: 48 },
      { folder: 'mipmap-hdpi', size: 72 },
      { folder: 'mipmap-xhdpi', size: 96 },
      { folder: 'mipmap-xxhdpi', size: 144 },
      { folder: 'mipmap-xxxhdpi', size: 192 }
    ];

    for (const { folder, size } of MIPMAP_CONFIG) {
      const targetDir = path.join(RES_DIR, folder);
      if (fs.existsSync(targetDir)) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: size,
          height: size,
          deviceScaleFactor: 1,
          mobile: false
        });
        await navigateTo(`http://127.0.0.1:${HTTP_PORT}/icon-render-${size}.html`);
        const iconPath = path.join(targetDir, 'ic_launcher.png');
        const iconRoundPath = path.join(targetDir, 'ic_launcher_round.png');
        await captureImage(iconPath, size, size);
        fs.copyFileSync(iconPath, iconRoundPath);
      }
    }

    console.log("\n=== 4. Capturing Phone Screenshots (1080x2400 Portrait) ===");
    // Set 360 x 800 with DPR 3.0 = exactly 1080 x 2400 physical pixels
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 3.0,
      mobile: true
    });

    // Screenshot 1: Menu & Mode Selectors
    await navigateTo(`http://127.0.0.1:${HTTP_PORT}/index.html`);
    await new Promise(r => setTimeout(r, 400));
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'screenshot-1-menu.png'), Buffer.from(ss1.data, 'base64'));
    console.log("  ✓ Captured screenshot-1-menu.png (1080x2400)");

    // Screenshot 2: Active Large 11x15 Gameplay with Selection
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.game.launchGame('challenge', 'large');
        // Synthesize an active selection over 2 cells
        window.game.dragState = {
          active: true,
          startR: 3, startC: 2,
          currentR: 3, currentC: 3
        };
      })()`
    });
    await new Promise(r => setTimeout(r, 300));
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'screenshot-2-gameplay.png'), Buffer.from(ss2.data, 'base64'));
    console.log("  ✓ Captured screenshot-2-gameplay.png (1080x2400)");

    // Screenshot 3: Tactical Skills Dock with Golden Hint
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.game.missions.addCareerScore(300000);
        window.game.updateSkillsUI();
        window.game.useSkill('clairvoyance');
      })()`
    });
    await new Promise(r => setTimeout(r, 300));
    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'screenshot-3-skills.png'), Buffer.from(ss3.data, 'base64'));
    console.log("  ✓ Captured screenshot-3-skills.png (1080x2400)");

    // Screenshot 4: Missions Career Progression Modal
    await send('Runtime.evaluate', {
      expression: `window.game.openMissions()`
    });
    await new Promise(r => setTimeout(r, 300));
    const ss4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'screenshot-4-missions.png'), Buffer.from(ss4.data, 'base64'));
    console.log("  ✓ Captured screenshot-4-missions.png (1080x2400)");

    console.log("\n🎉 ALL GOOGLE PLAY ASSETS GENERATED PERFECTLY!");

    ws.close();
  } finally {
    browser.kill();
    server.close();
  }
}

run().catch(err => {
  console.error("Asset Generation Failed:", err);
  process.exit(1);
});

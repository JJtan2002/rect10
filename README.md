# Rect10 — 10-Sum Grid Puzzle

> A fast-paced, tactile arithmetic puzzle game engineered for mobile devices. Drag to select rectangular regions summing to exactly 10 on an 11×15 grid. Built with zero runtime dependencies, high-DPI Canvas 2D rendering, sub-microsecond prefix sum queries, procedural Web Audio synthesis, multi-tier persistent leaderboards, tactile haptics, and offline PWA support.

---

## Game Mechanics

1. **The Grid:** An $11 \times 15$ grid containing integers from $1$ to $9$. Numbers are sampled via a low-number weighted distribution ($\{1, 2, 3, 4\}$ favored) to ensure rich combinations of $2$-cell, $3$-cell, and $4$-cell rectangles.
2. **Mental Addition (No Hints):** Drag to select any rectangular bounding box. The selection outline remains strictly neutral—**no live sum counters or green/red correctness hints**. The player must perform the addition mentally before releasing.
3. **Release to Commit:** Upon releasing the pointer:
   * If the sum is **exactly 10**: All active numbers in the box clear, awarding $+10\text{ points} \times (\text{active cells cleared})$.
   * If the sum is $\ne 10$: The selection cleanly dismisses with no penalty.
4. **Empty Space Tunneling:** Cleared cells leave empty tiles ($0$). These tiles contribute $0$ to subsequent rectangle sums, acting as zero-cost bridges (e.g. $[4] - [\text{empty}] - [6] = 10$).
5. **The Strategic Trade-Off:** Clearing large composite rectangles ($1-2-3-4$ for $+40\text{ pts}$) yields high immediate score, but consumes low digits that could otherwise match isolated high numbers ($6, 7, 8, 9$).
6. **100-Second Clock & Deadlock Detection:** Play against a 100-second timer with a dynamic urgency bar. The round terminates when time runs out or when no valid sum-10 rectangles remain on the board.

---

## Native Mobile Hardening & Features (Phase 5)

* **Multi-Tier Persistent Leaderboards:** Tracks **All-Time Records**, **Weekly Bests** (ISO calendar weeks resetting Mondays), and **Daily Bests** (resetting at midnight local time) in persistent storage, alongside a 10-run game history ledger.
* **Tactile Haptic Feedback (Web Vibration API):** Subtle $8\text{ms}$ micro-pulse on cell boundary drags, distinct double-pulse on sum-10 clears, and rhythmic celebratory burst on new records. Toggleable via 📳 button in header.
* **Screen Wake Lock API:** Keeps mobile screens active during 100-second gameplay sessions without dimming or sleeping.
* **Android Hardware Back Button & Gesture Navigation:** Automatically binds to browser history state (`popstate`) so back gestures naturally dismiss modals or pause the active round rather than exiting the application.
* **Offline PWA Shell (`sw.js` & `manifest.json`):** Pre-caches application assets, allowing full offline playability and installability to mobile home screens.

---

## Quickstart (Running Locally)

Rect10 is completely zero-dependency and requires no build steps or bundlers.

### Option 1: Direct Browser Launch
```powershell
cd rect10
Start-Process index.html
```

### Option 2: Local HTTP Server (Desktop & Mobile Wi-Fi Testing)
```powershell
cd rect10
python -m http.server 8080
```
Then navigate to `http://localhost:8080` on your PC, or `http://<YOUR_LOCAL_IP>:8080` on your phone browser.

---

## Running Tests & Benchmarks

Rect10 includes three test suites: a pure Node.js mathematical engine suite, a multi-tier leaderboard persistence suite, and an automated headless Chrome/Edge browser integration test running over Chrome DevTools Protocol (CDP).

### Run All Tests:
```powershell
npm test
```

### 1. Engine Verification Suite & Microbenchmarks:
```powershell
npm run test:unit
```
* **Correctness:** Verifies $O(1)$ prefix sum queries against 1,000 random subgrids, 2-cell/4-cell scoring, zero-value tunneling, and deadlock detection.
* **Hot-Path Benchmarks:**
  * **2D Prefix Sum Lookup:** $\approx 5.6\text{ ns}$ per query (target: $< 50\text{ ns}$).
  * **Full Board Deadlock Scan:** $\approx 0.003\text{ ms}$ per scan (target: $< 1.0\text{ ms}$).

### 2. Leaderboard Unit Suite:
```powershell
npm run test:leaderboard
```
* Verifies ISO day/week formatting, all-time/weekly/daily rollover, legacy migration, and run history capping.

### 3. Automated Headless Browser CDP Test:
```powershell
npm run test:browser
```
* Spawns a real headless browser session over WebSocket CDP.
* Verifies pointer events, instant mouse release evaluation without cursor movement, Leaderboard modal UI, Android back button (`popstate`), and haptic toggles.

---

## Key Performance Telemetry

| Metric | Target | Actual Measured | Headroom |
| :--- | :--- | :--- | :--- |
| **Prefix Sum Query** | $< 50\,\text{ns}$ | **$5.6\,\text{ns}$** | $89\%$ |
| **Full Board Move Scan** | $< 1.0\,\text{ms}$ | **$0.003\,\text{ms}$** | $99.7\%$ |
| **Frame Render Time** | $< 8.33\,\text{ms}$ ($120\text{Hz}$) | **$0.25\,\text{ms}$** | $97\%$ |
| **Active Loop Allocations** | $0\,\text{bytes}$ | **$0\,\text{bytes}$** | $100\%$ |

---

## Project Structure

```text
rect10/
├── index.html        # Responsive mobile-first shell, HUD, and modals
├── style.css         # Dark theme (#090d16), notch support, and modal styles
├── manifest.json     # PWA Web App Manifest for mobile installation
├── sw.js             # Offline-first Service Worker cache
├── icon.svg          # High-contrast vector launcher icon
├── package.json      # Test runner scripts and metadata
├── ARCHITECTURE.md   # Deep architectural and mathematical design documentation
├── README.md         # Project documentation & quickstart
├── js/
│   ├── engine.js     # Pure logic: 2D prefix sums, weighted RNG, monotonic move finder
│   ├── view.js       # High-DPI Canvas 2D presentation & tile dissolve animations
│   ├── audio.js      # Zero-dependency procedural Web Audio acoustic synthesizer
│   ├── leaderboard.js# Multi-tier persistent leaderboard (Daily, Weekly, All-Time)
│   ├── haptics.js    # Web Vibration API controller
│   └── game.js       # Application coordinator, wake lock, and gesture navigation
└── tests/
    ├── test_engine.js        # Mathematical verification & latency microbenchmarks
    ├── test_leaderboard.js   # Multi-tier leaderboard rollover & migration unit tests
    └── test_click_release.js # Headless browser CDP integration test
```

---

## License

MIT License. Designed and engineered by [JJtan2002](https://github.com/JJtan2002).

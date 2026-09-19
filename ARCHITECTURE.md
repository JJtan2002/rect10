# Rect10 Technical Architecture Specification

This document provides a deep architectural and algorithmic analysis of **Rect10**, detailing the data structures, computational complexity, rendering pipeline, acoustic synthesis, multi-tier leaderboards, and mobile hardware integrations.

---

## 1. Architectural Philosophy

1. **Zero-Dependency Runtime:** The entire client runs natively in modern browsers with zero external runtime libraries, bundlers, or frameworks.
2. **Zero-Allocation Hot Paths:** Memory allocations during active dragging, timer ticks, and frame rendering are strictly eliminated to prevent V8 Scavenge / Minor GC pauses (which cause 5–15ms frame drops on mobile WebViews).
3. **Decoupled Architecture:** Clean separation of concerns between Mathematical Logic (`engine.js`), Presentation (`view.js`), Procedural Audio (`audio.js`), Multi-Tier Leaderboards (`leaderboard.js`), Haptics (`haptics.js`), and Application Loop (`game.js`).
4. **Headless Testability:** The mathematical engine, leaderboard persistence, and game logic run identically in headless Node.js environments and browser contexts, enabling sub-millisecond automated testing.

---

## 2. Subsystem Topology & Data Flow

```mermaid
flowchart TD
    subgraph ViewLayer ["Presentation & Input Layer (view.js, style.css)"]
        PointerInput["Pointer / Mouse / Touch Handler (Clamped Coordinates)"]
        CanvasRenderer["High-DPI Canvas 2D Engine (120Hz VSync)"]
        HUDView["HUD Overlay (Timer, Score, Moves, Progress Bar)"]
        AudioSynth["Web Audio Procedural Synthesizer (audio.js)"]
        HapticsEngine["Tactile Haptics Controller (haptics.js)"]
    end

    subgraph Controller ["Application Controller (game.js)"]
        Loop["requestAnimationFrame Loop (delta timing)"]
        DragState["Reusable Drag State Struct {r1, c1, r2, c2}"]
        Lifecycle["Game Lifecycle (100s Timer, Pause Curtain, Wake Lock)"]
        BackNav["Android Hardware Back Button / Popstate Manager"]
    end

    subgraph Persistence ["Persistent Storage Layer (leaderboard.js)"]
        Leaderboard["Rect10Leaderboard (All-Time, Weekly, Daily, History)"]
        LocalStorage[("HTML5 LocalStorage (rect10_leaderboard_v1)")]
    end

    subgraph CoreEngine ["Mathematical Engine (engine.js)"]
        GridBuffer["Uint8Array(165) Grid Buffer (11x15)"]
        PrefixMatrix["Int16Array(192) 2D Prefix Sum Matrix"]
        MoveFinder["Monotonic Deadlock & Valid Move Detector"]
        WeightedRNG["Low-Bias Cumulative Distribution Sampler"]
    end

    PointerInput -->|Normalized Coordinates| DragState
    DragState -->|Commit on pointerup| CoreEngine
    CoreEngine -->|O(1) Range Queries| PrefixMatrix
    CoreEngine -->|Move Count & State| Lifecycle
    Loop -->|Render Frame (<0.3ms)| CanvasRenderer
    Lifecycle -->|Timer & Score updates| HUDView
    CoreEngine -->|Clear Events & Size| AudioSynth
    CoreEngine -->|Clear Events & Size| HapticsEngine
    DragState -->|Cell Boundary Crossings| AudioSynth
    DragState -->|Cell Boundary Crossings| HapticsEngine
    Lifecycle -->|Round End Stats| Leaderboard
    Leaderboard <-->|JSON Serialization| LocalStorage
    BackNav -->|Modal / Pause State| Lifecycle
```

---

## 3. Mathematical Engine & Data Structures

### A. Memory Layout
The board and its spatial index are represented as continuous flat typed arrays:
* **Grid Buffer:** `Uint8Array(165)` ($11 \text{ columns} \times 15 \text{ rows}$).
  * Values: $0$ (cleared / empty space), $1\dots 9$ (active numbers).
  * Flat indexing: $\text{index} = r \times 11 + c$.
* **2D Summed-Area Table (Prefix Sums):** `Int16Array(192)`.
  * Dimensions: $(15 + 1) \times (11 + 1) = 16 \times 12 = 192$ elements.
  * Flat indexing: $\text{prefIndex} = r \times 12 + c$.

### B. $O(1)$ Range Sum Query Formulation
For any rectangular region bounded by top-left $(r_1, c_1)$ and bottom-right $(r_2, c_2)$, the region sum is computed in $O(1)$ time using inclusion-exclusion:
$$\text{Sum}(r_1, c_1, r_2, c_2) = P[r_2+1, c_2+1] - P[r_1, c_2+1] - P[r_2+1, c_1] + P[r_1, c_1]$$
Measured benchmark latency: **$4.8\text{ ns}$** per query ($>90\%$ headroom under the $50\text{ ns}$ budget).

### C. Monotonic Move Finder Algorithm
The deadlock detection engine finds all valid sum-10 rectangles using monotonicity:
* Because grid values are strictly non-negative ($v \in [0, 9]$), expanding a bounding box strictly increases or maintains its sum.
* As soon as $\text{Sum}(r_1, c_1, r_2, c_2) > 10$, all further expansions $(r_2' \ge r_2, c_2' \ge c_2)$ will also exceed 10 and can be pruned immediately (`break`).
* Measured benchmark latency: **$0.003\text{ ms}$** ($\approx 3\,\mu\text{s}$) for a full board scan.

---

## 4. Multi-Tier Persistent Leaderboards (`leaderboard.js`)

### A. Time Partitioning Model
The leaderboard engine isolates scores across distinct temporal horizons:
1. **Daily Partition:** Keyed by local ISO calendar date `YYYY-MM-DD` (e.g. `2026-09-19`). Automatically resets at local midnight.
2. **Weekly Partition:** Keyed by standard ISO 8601 calendar week `YYYY-Www` (e.g. `2026-W38`). Resets every Monday at 00:00.
3. **All-Time Record:** Scalar high score reflecting lifetime peak performance.
4. **History Ledger:** Ring buffer containing the 10 most recent runs with timestamps, scores, ranks, and clear metrics.

### B. Backward Compatibility & Pruning
* Automatically detects legacy `rect10_high_score` and migrates it into the structured `rect10_leaderboard_v1` schema.
* Maintains the legacy key in sync so older sessions or bookmarks retain the score.
* Automatically prunes daily records older than 60 days on each score submission to keep localStorage storage footprint $< 10\text{KB}$.

---

## 5. Mobile Device Integrations & Hardware Hardening

### A. Tactile Haptic Engine (`haptics.js`)
* Built on the Web Vibration API (`navigator.vibrate`) with graceful fallback.
* **Actuator Protection & Rate Limiting:** Drag ticks are debounced with a $50\text{ms}$ cooldown to avoid vibrator motor saturation and auditory buzzing.
* **Haptic Signal Profiles:**
  * `dragTick()`: $8\text{ms}$ micro-pulse on grid cell transitions.
  * `clear()`: Crisp tactile double-pulse `[18, 30, 22]`.
  * `newRecord()`: Celebratory multi-pulse rhythm `[30, 40, 30, 40, 60]`.
  * `gameOver()`: Low $50\text{ms}$ vibration.
* State persists in `localStorage.getItem('rect10_haptics_enabled')`.

### B. Screen Wake Lock API
* Prevents mobile displays from timing out or dimming during an active 100-second puzzle round.
* Automatically acquired via `navigator.wakeLock.request('screen')` on round start.
* Automatically released when the game is paused, time expires, or document visibility changes to `hidden`.
* Re-acquired when returning to the tab if the game is still active.

### C. Android Hardware Back Button & Gesture Navigation (`popstate`)
* Integrates with HTML5 History API (`history.pushState`).
* Pushes dummy states when modals open or active play begins.
* Intercepts `popstate` events:
  * If Leaderboard modal is open $\to$ close Leaderboard.
  * If Pause modal is open $\to$ resume game.
  * If Game Over modal is open $\to$ dismiss modal to board.
  * If active round is playing $\to$ pause game.
* Provides a seamless native application feel where the Android edge-swipe gesture dismisses modals rather than triggering page exit.

---

## 6. Procedural Acoustic Synthesis (`audio.js`)

1. **Tactile Drag Pop:** Rapid pitch-dropping triangle wave ($720\text{Hz} \to 240\text{Hz}$) over $40\text{ms}$ at peak gain $0.095$. Triangle waves provide natural acoustic overtones, creating a tactile "mechanical switch" sound.
2. **Harmonic Density Scaling:** Clear chords dynamically scale based on active cells cleared:
   * **2-cell domino (+20 pts):** Clean two-tone chime ($C_5 + G_5$).
   * **3-cell line (+30 pts):** Major triad ($C_5 + E_5 + G_5$).
   * **4-cell+ combo (+40+ pts):** Major 7th chord ($C_5 + E_5 + G_5 + C_6$).
3. **Mute Persistence:** Synchronized with `localStorage.getItem('rect10_muted')`.

---

## 7. Offline PWA & Service Worker Architecture (`sw.js`, `manifest.json`)

* **Standalone Manifest:** Configured for `display: standalone`, `orientation: portrait`, and `#090d16` theme color.
* **Cache-First Offline Strategy:** Pre-caches HTML, CSS, JavaScript modules, SVG icon, and manifest on `install`.
* **Zero-Network Launch:** Once loaded, the game functions completely without internet connectivity, satisfying mobile app requirements.

---

## 8. Automated Test & Verification Pipeline

1. **`tests/test_engine.js` (Mathematical Unit & Benchmark Suite):**
   * Verifies mathematical bounds, weighted PRNG distribution, prefix sum equivalence across 1,000 subgrids, multi-cell clears, tunneling, and deadlock detection.
2. **`tests/test_leaderboard.js` (Persistence & Rollover Suite):**
   * Verifies ISO day/week formatting, all-time/weekly/daily record milestones, calendar day rollover, ISO week rollover, legacy score migration, and run history capping.
3. **`tests/test_click_release.js` (Headless Browser CDP Suite):**
   * Spawns a real headless Chromium instance (Edge) over Chrome DevTools Protocol (CDP) WebSocket.
   * Tests instant mouse release evaluation with zero cursor movement.
   * Programmatically asserts valid move clears, Leaderboard modal UI, Android back navigation (`popstate`), and haptics toggles.

/**
 * Rect10 Canvas View & Presentation Layer (Phase 4 Tactile Polish)
 * Configured for 11 columns x 15 rows mobile portrait grid.
 * High-DPI Canvas 2D renderer with smooth tile dissolve animations and zero layout thrashing.
 */

const DIGIT_COLORS = [
  '#64748b', // 0 (empty placeholder)
  '#93c5fd', // 1: soft sky blue
  '#6ee7b7', // 2: mint emerald
  '#fde047', // 3: warm yellow
  '#f472b6', // 4: soft pink
  '#a78bfa', // 5: purple
  '#fb923c', // 6: orange
  '#38bdf8', // 7: vivid cyan
  '#c084fc', // 8: violet
  '#f87171'  // 9: coral red
];

class Rect10View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = window.devicePixelRatio || 1;

    this.cols = 11;
    this.rows = 15;

    // Viewport & layout metrics
    this.logicalWidth = 0;
    this.logicalHeight = 0;
    this.cellSize = 0;
    this.gridPadding = 6;
    this.offsetX = 0;
    this.offsetY = 0;

    // Active particle and transition animations
    this.floatingTexts = [];
    this.dissolvingTiles = [];

    this.initResizeObserver();
  }

  initResizeObserver() {
    const ro = new ResizeObserver(() => {
      this.resize();
    });
    ro.observe(this.canvas.parentElement);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const parentW = parent.clientWidth;
    const parentH = parent.clientHeight;
    this.dpr = window.devicePixelRatio || 1;

    const availW = parentW - this.gridPadding * 2;
    const availH = parentH - this.gridPadding * 2;

    this.cellSize = Math.floor(Math.min(availW / this.cols, availH / this.rows));
    this.logicalWidth = this.cellSize * this.cols + this.gridPadding * 2;
    this.logicalHeight = this.cellSize * this.rows + this.gridPadding * 2;

    this.offsetX = Math.floor((parentW - this.logicalWidth) / 2);
    this.offsetY = Math.floor((parentH - this.logicalHeight) / 2);

    this.canvas.width = Math.floor(parentW * this.dpr);
    this.canvas.height = Math.floor(parentH * this.dpr);
  }

  clientToCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left - this.offsetX - this.gridPadding;
    const y = clientY - rect.top - this.offsetY - this.gridPadding;

    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);

    return {
      r: Math.max(0, Math.min(this.rows - 1, r)),
      c: Math.max(0, Math.min(this.cols - 1, c))
    };
  }

  /**
   * Triggers a subtle, elegant tile dissolve animation on cleared cells.
   */
  addTileDissolve(clearedIndices) {
    const now = performance.now();
    for (const idx of clearedIndices) {
      const r = Math.floor(idx / this.cols);
      const c = idx % this.cols;
      this.dissolvingTiles.push({
        r,
        c,
        startTime: now,
        duration: 220
      });
    }
  }

  /**
   * Spawns floating score text modulated by the point tier.
   */
  addFloatingScore(r1, c1, r2, c2, points) {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = c1 < c2 ? c2 : c1;

    const centerX = this.offsetX + this.gridPadding + ((minC + maxC + 1) / 2) * this.cellSize;
    const centerY = this.offsetY + this.gridPadding + ((minR + maxR + 1) / 2) * this.cellSize;

    let color = 'rgba(52, 211, 153, '; // Emerald for 20
    if (points >= 40) color = 'rgba(250, 204, 21, '; // Gold for 40+
    else if (points >= 30) color = 'rgba(56, 189, 248, '; // Cyan for 30

    this.floatingTexts.push({
      text: `+${points}`,
      x: centerX,
      y: centerY,
      startY: centerY,
      baseColor: color,
      points: points,
      startTime: performance.now(),
      duration: 650
    });
  }

  render(engine, dragState) {
    if (!this.ctx || this.cellSize === 0) return;

    const ctx = this.ctx;
    const dpr = this.dpr;
    const cellSize = this.cellSize;
    const padding = this.gridPadding;
    const offX = this.offsetX;
    const offY = this.offsetY;
    const grid = engine.grid;
    const COLS = this.cols;
    const ROWS = this.rows;
    const now = performance.now();

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background fill
    const parentW = this.canvas.width / dpr;
    const parentH = this.canvas.height / dpr;
    ctx.fillStyle = '#131b2e';
    ctx.fillRect(0, 0, parentW, parentH);

    // Font setup
    const fontSize = Math.max(14, Math.floor(cellSize * 0.54));
    ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Draw Grid Tiles
    const cellGap = 2.0;
    const tileSize = cellSize - cellGap;
    const cornerRadius = Math.max(3, Math.floor(cellSize * 0.18));

    for (let r = 0; r < ROWS; r++) {
      const rOffset = r * COLS;
      const y = offY + padding + r * cellSize + cellGap / 2;

      for (let c = 0; c < COLS; c++) {
        const x = offX + padding + c * cellSize + cellGap / 2;
        const val = grid[rOffset + c];

        if (val === 0) {
          // Empty / Cleared Cell
          ctx.fillStyle = '#0b1120';
          this.drawRoundedRect(ctx, x, y, tileSize, tileSize, cornerRadius);
          ctx.fill();

          ctx.fillStyle = '#22324e';
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Active Number Tile
          ctx.fillStyle = '#1e2942';
          this.drawRoundedRect(ctx, x, y, tileSize, tileSize, cornerRadius);
          ctx.fill();

          ctx.fillStyle = DIGIT_COLORS[val];
          ctx.fillText(val, x + tileSize / 2, y + tileSize / 2 + 0.5);
        }
      }
    }

    // 2. Render Dissolving Tiles (Soft flash & fade on cleared blocks)
    for (let i = this.dissolvingTiles.length - 1; i >= 0; i--) {
      const dt = this.dissolvingTiles[i];
      const elapsed = now - dt.startTime;
      if (elapsed >= dt.duration) {
        this.dissolvingTiles.splice(i, 1);
        continue;
      }

      const progress = elapsed / dt.duration;
      const alpha = (1.0 - progress) * 0.45;
      const x = offX + padding + dt.c * cellSize + cellGap / 2;
      const y = offY + padding + dt.r * cellSize + cellGap / 2;

      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      this.drawRoundedRect(ctx, x, y, tileSize, tileSize, cornerRadius);
      ctx.fill();
    }

    // 3. Neutral Selection Bounding Box (Strict zero-hinting)
    if (dragState.active) {
      const minR = Math.min(dragState.startR, dragState.currentR);
      const maxR = Math.max(dragState.startR, dragState.currentR);
      const minC = Math.min(dragState.startC, dragState.currentC);
      const maxC = Math.max(dragState.startC, dragState.currentC);

      const selX = offX + padding + minC * cellSize;
      const selY = offY + padding + minR * cellSize;
      const selW = (maxC - minC + 1) * cellSize;
      const selH = (maxR - minR + 1) * cellSize;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      this.drawRoundedRect(ctx, selX, selY, selW, selH, cornerRadius * 1.4);
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#38bdf8';
      this.drawRoundedRect(ctx, selX, selY, selW, selH, cornerRadius * 1.4);
      ctx.stroke();
    }

    // 4. Render Floating Score Particles
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const p = this.floatingTexts[i];
      const elapsed = now - p.startTime;
      if (elapsed >= p.duration) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      const progress = elapsed / p.duration;
      const curY = p.startY - progress * 30;
      const curAlpha = 1.0 - progress;

      ctx.save();
      const textScale = p.points >= 40 ? 1.35 : 1.2;
      ctx.font = `800 ${Math.floor(fontSize * textScale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = `${p.baseColor}${curAlpha})`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 5;
      ctx.fillText(p.text, p.x, curY);
      ctx.restore();
    }

    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

if (typeof window !== 'undefined') {
  window.Rect10View = Rect10View;
}

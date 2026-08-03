# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to run

```bash
open index.html        # macOS
# or serve locally:
python3 -m http.server 8000   # then open http://localhost:8000
```

Zero dependencies, no build step. Just a browser.

## Architecture

Three flat files, no directories:

- **`index.html`** — DOM structure: two `<canvas>` elements (board 300×600, next-piece preview 120×120), HUD (score/lines/level), overlay for pause/game-over.
- **`style.css`** — Dark arcade theme, flexbox layout, `backdrop-filter` blur on overlays.
- **`game.js`** — All game logic (~300 lines). `'use strict'` mode.

### game.js data flow

```
init() → createBoard(), randomPiece(), spawn(), requestAnimationFrame(loop)
  loop(ts) → accumulate dt → gravity drop or lockPiece() → draw() → rAF(loop)
  keydown → move/rotate/drop → updateHUD()
  lockPiece() → merge() → clearLines() → spawn()
  spawn() collision → endGame() → show overlay
```

**State** (line 43): `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`.

**Board model**: `ROWS×COLS` 2D array, 0 = empty, 1–8 = piece color index.

**Pieces**: Defined as 2D matrices in `PIECES[1..8]`. Rotation via `rotateCW()` (transpose + row reverse). Collision detection via `collide(shape, ox, oy)`. Wall kicks try offsets [0, -1, 1, -2, 2] in `tryRotate()`. The nut (piece 8) is a 3×3 ring whose center cell is `-1`: a sentinel that is solid for collision but never merged into the board (`merge()` writes only `> 0`) and never drawn (`drawBlock()` skips `< 0`).

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level. Hard drop: 2pts/row. Soft drop: 1pt/row. Level up every 10 lines.

**Speed**: `dropInterval = max(100, 1000 - (level-1) * 90)` ms.

**Rendering**: Canvas 2D API. Ghost piece drawn at `globalAlpha = 0.2` via `ghostY()` projection.

### Tuneable constants

| Constant | Default | Meaning |
|---|---|---|
| `COLS` | 10 | Board columns |
| `ROWS` | 20 | Board rows |
| `BLOCK` | 30 | Cell px size |
| `COLORS` | 8 colors | Piece color palette |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points per 1/2/3/4 lines |

If changing `COLS`/`ROWS`/`BLOCK`, also update `width`/`height` on `<canvas id="board">` in `index.html`.

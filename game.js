'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    grid: '#22222e',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - blue
      '#ffb74d', // L - orange
      '#b0bec5', // NUT - gray steel
    ],
    draw: drawBlockRetro,
    bg: null,
  },
  neon: {
    grid: '#1a2a3a',
    colors: [
      null,
      '#00f0ff', // I - cyan
      '#ffee00', // O - yellow
      '#ff3dff', // T - purple
      '#00ff88', // S - green
      '#ff3355', // Z - red
      '#4488ff', // J - blue
      '#ff8800', // L - orange
      '#aab4ff', // NUT - lavender
    ],
    draw: drawBlockNeon,
    bg: '#050510',
  },
  pastel: {
    grid: '#e8e0e8',
    colors: [
      null,
      '#a8d8ea', // I - soft cyan
      '#fff3b0', // O - soft yellow
      '#d8b4e2', // T - soft purple
      '#c8e6c9', // S - soft green
      '#ffcdd2', // Z - soft red
      '#b3cde0', // J - soft blue
      '#ffe0b2', // L - soft orange
      '#e0e0e0', // NUT - soft gray
    ],
    draw: drawBlockPastel,
    bg: null,
  },
  pixel: {
    grid: '#39444a',
    colors: [
      null,
      '#2ac3de', // I - cyan
      '#f8d030', // O - yellow
      '#c44fd4', // T - purple
      '#4ca43c', // S - green
      '#d43c3c', // Z - red
      '#3c54d4', // J - blue
      '#d4782c', // L - orange
      '#b0a8a0', // NUT - tan gray
    ],
    draw: drawBlockPixel,
    bg: null,
  },
};

let currentSkin = 'retro';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,-1,8],[8,8,8]],                 // NUT (3x3 ring, -1 = solid hole)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const maxLinesEl = document.getElementById('max-lines');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseResumeBtn = document.getElementById('pause-resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsPanel = document.getElementById('pause-controls-panel');
const startLevelSelect = document.getElementById('start-level-select');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverScore = document.getElementById('gameover-score');
const recordEntry = document.getElementById('record-entry');
const playerName = document.getElementById('player-name');
const recordSaveBtn = document.getElementById('record-save-btn');
const recordsTableGameover = document.getElementById('records-table-gameover');
const recordsStatsGameover = document.getElementById('records-stats-gameover');
const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
const startScreen = document.getElementById('start-screen');
const recordsTableStart = document.getElementById('records-table-start');
const recordsStatsStart = document.getElementById('records-stats-start');
const startBtn = document.getElementById('start-btn');
const recordsResetBtn = document.getElementById('records-reset-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo = 0, bestCombo = 0, maxLines = 0;

const initHooks = [];
function addInitHook(fn) { initHooks.push(fn); }

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c] > 0)
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex || colorIndex < 0) return;
  SKINS[currentSkin].draw(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

/* ---- Skins ---- */
function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = SKINS[currentSkin].colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = SKINS[currentSkin].colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const color = SKINS[currentSkin].colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 7);
    context.fill();
  } else {
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  }
  context.globalAlpha = 1;
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const color = SKINS[currentSkin].colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // dither checker 2px
  context.fillStyle = 'rgba(0,0,0,0.22)';
  for (let dx = 1; dx < size - 1; dx += 2) {
    for (let dy = 1; dy < size - 1; dy += 2) {
      if (((dx + dy) / 2) % 2 === 0) {
        context.fillRect(x * size + dx, y * size + dy, 2, 2);
      }
    }
  }
  context.globalAlpha = 1;
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  localStorage.setItem('tetris-skin', name);
  canvas.style.background = SKINS[name].bg || '';
  nextCanvas.style.background = SKINS[name].bg || '';
  if (typeof current !== 'undefined' && current) {
    draw();
    drawNext();
  }
}

function loadSkin() {
  return localStorage.getItem('tetris-skin') || 'retro';
}

function initSkins() {
  skinSelect.value = loadSkin();
  applySkin(loadSkin());
}

skinSelect.addEventListener('change', () => applySkin(skinSelect.value));
initSkins();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  gameoverScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  gameoverOverlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  if (!startScreen.classList.contains('hidden')) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
    pauseResumeBtn.focus();
  }
}

function getStartLevel() {
  const saved = parseInt(localStorage.getItem('tetris-start-level'), 10);
  if (isNaN(saved)) return 1;
  return Math.min(15, Math.max(1, saved));
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) {
    animId = requestAnimationFrame(loop);
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  startScreen.classList.add('hidden');
  initHooks.forEach(fn => fn());
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  const menuOpen =
    !pauseOverlay.classList.contains('hidden') ||
    !gameoverOverlay.classList.contains('hidden') ||
    !startScreen.classList.contains('hidden');
  if (menuOpen) {
    if (e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

/* ---- Pause menu wiring ---- */
pauseResumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});
pauseRestartBtn.addEventListener('click', () => {
  init();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
});
pauseControlsBtn.addEventListener('click', () => {
  const isHidden = pauseControlsPanel.classList.contains('hidden');
  pauseControlsPanel.classList.toggle('hidden');
  pauseControlsBtn.textContent = isHidden ? 'Ocultar controles' : 'Ver controles';
});
startLevelSelect.addEventListener('change', () => {
  localStorage.setItem('tetris-start-level', startLevelSelect.value);
});
startLevelSelect.value = String(getStartLevel());

/* ---- Theme toggle ---- */
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.icon');
const themeLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
  themeLabel.textContent = theme === 'light' ? 'CLARO' : 'OSCURO';
}

function loadTheme() {
  const saved = localStorage.getItem('tetris-theme');
  return saved || 'dark';
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('tetris-theme', next);
});

// Apply saved theme on load
applyTheme(loadTheme());

/* ---- Debug / e2e handle ---- */
window.__tetris = {
  getState: () => ({
    score, lines, level, combo, bestCombo, maxLines, paused, gameOver,
    board: board && board.map(r => [...r]),
  }),
  debug: {},
};

init();

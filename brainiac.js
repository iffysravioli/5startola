const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");
const livesTrack = document.getElementById("livesTrack");

const TILE = 26;
const COLS = 28;
const ROWS = 14;

canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

/* Score */
let score = 0;
let high = Number(localStorage.getItem("bb_high") || 0);
scoreEl.textContent = "0";
highEl.textContent = String(high);

function updateHigh() {
  if (score > high) {
    high = score;
    localStorage.setItem("bb_high", String(high));
    highEl.textContent = String(high);
  }
}

/* Lives */
let lives = 3;
const MAX_LIVES = 5;

/* Assets */
const pacboyImg = new Image();
pacboyImg.src = "assets/pacboy.png";

const bibleImg = new Image();
bibleImg.src = "assets/powerup1.png";

const appleImg = new Image();
appleImg.src = "assets/powerup2.png";

const heartImg = new Image();
heartImg.src = "assets/powerup3.png";

const enemy1Img = new Image();
enemy1Img.src = "assets/enemy1.png";

const enemy2Img = new Image();
enemy2Img.src = "assets/enemy2.png";

const enemy3Img = new Image();
enemy3Img.src = "assets/enemy3.png";

/* Home button support */
const homeBtnTop = document.querySelector(".pmHomeBtn") || document.getElementById("homeBtn");
if (homeBtnTop) {
  homeBtnTop.addEventListener("click", () => {
    window.location.href = "select.html";
  });
}

/* Input */
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/* Maze */
const MAZE = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####....#####.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.......##.......####.#",
  "#............##............#",
  "############################",
];

let grid = [];
let jailRect = { x: 0, y: 0, w: 0, h: 0 };

let gateY = 0;
let gateXs = [];
let gateMidX = 0;


for (let i = 0; i < MAZE.length; i++) {
  if (MAZE[i].length !== COLS) {
    console.log("MAZE row wrong length", i, MAZE[i].length, MAZE[i]);
  }
}



/* Player */
const player = {
  x: 1,
  y: 1,
  dir: { x: 0, y: 0 },
  next: { x: 0, y: 0 },
  spawnX: 1,
  spawnY: 1,
};

/* Helpers */
function buildGrid() {
  grid = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => {
      const row = MAZE[y] || "";
      const ch = row[x] || "#";

      // normalize mistakes
      if (ch === " ") return ".";

      // allowed tiles
      if (ch === "#" || ch === ".") return ch;

      // anything else becomes floor
      return " ";
    })
  );
}

function isWall(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  const c = grid[y][x];
  return c === "#" || c === "G";
}

function eatPellet() {
  const c = grid[player.y][player.x];
  if (c === ".") {
    grid[player.y][player.x] = " ";
    score += 10;
    scoreEl.textContent = String(score);
    updateHigh();
  }
}

function allPelletsGone() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === ".") return false;
    }
  }
  return true;
}

function renderLives() {
  if (!livesTrack) return;
  livesTrack.innerHTML = "";
  for (let i = 0; i < lives; i++) {
    const img = document.createElement("img");
    img.src = "assets/pacboy.png";
    img.className = "bbLifeIcon";
    img.alt = "life";
    livesTrack.appendChild(img);
  }
}

/* Jail and gate */
function addJailToGrid() {
  const w = 10;
  const h = 5;

  const startX = Math.floor(COLS / 2) - Math.floor(w / 2);
  const startY = Math.floor(ROWS / 2) - Math.floor(h / 2);
  jailRect = { x: startX, y: startY, w, h };

  for (let y = startY; y < startY + h; y++) {
    for (let x = startX; x < startX + w; x++) {
      const border =
        y === startY ||
        y === startY + h - 1 ||
        x === startX ||
        x === startX + w - 1;

      grid[y][x] = border ? "#" : " ";
    }
  }

  const gx = startX + Math.floor(w / 2) - 1;
  const gy = startY;

  gateY = gy;
  gateXs = [gx, gx + 1, gx + 2];
  gateMidX = gx + 1;

  grid[gy][gx] = "G";
  grid[gy][gx + 1] = "G";
  grid[gy][gx + 2] = "G";

  for (let y = startY - 1; y <= startY + h; y++) {
    for (let x = startX - 1; x <= startX + w; x++) {
      if (y < 0 || x < 0 || y >= ROWS || x >= COLS) continue;
      if (grid[y][x] === ".") grid[y][x] = " ";
    }
  }
}

function insideJail(x, y) {
  return (
    x >= jailRect.x &&
    x < jailRect.x + jailRect.w &&
    y >= jailRect.y &&
    y < jailRect.y + jailRect.h
  );
}

function jailSlots() {
  const left = jailRect.x + 3;
  const mid = jailRect.x + Math.floor(jailRect.w / 2);
  const right = jailRect.x + jailRect.w - 4;
  const y = jailRect.y + Math.floor(jailRect.h / 2);
  return [
    { x: left, y },
    { x: mid, y },
    { x: right, y },
  ];
}

/* Powerups */
let slowUntilMs = 0;
let collected = { B: false, A: false, H: false };

function isValidPowerSpot(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  const c = grid[y][x];
  if (c === "#" || c === "G") return false;
  if (insideJail(x, y)) return false;
  return true;
}

function placePowerupsRandom() {
  collected = { B: false, A: false, H: false };

  const candidates = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isValidPowerSpot(x, y)) candidates.push({ x, y });
    }
  }

  function pickFar(minDist) {
    const filtered = candidates.filter((p) => {
      const d = Math.abs(p.x - player.x) + Math.abs(p.y - player.y);
      return d >= minDist;
    });

    const pool = filtered.length ? filtered : candidates;
    const i = Math.floor(Math.random() * pool.length);
    const chosen = pool[i];

    const idx = candidates.findIndex((c) => c.x === chosen.x && c.y === chosen.y);
    if (idx >= 0) candidates.splice(idx, 1);

    return chosen;
  }

  const b = pickFar(10);
  const a = pickFar(10);
  const h = pickFar(8);

  if (b) grid[b.y][b.x] = "B";
  if (a) grid[a.y][a.x] = "A";
  if (h) grid[h.y][h.x] = "H";
}

function allPowerupsCollected() {
  return collected.B && collected.A && collected.H;
}

function collectPowerup(nowMs) {
  const cell = grid[player.y][player.x];

  if (cell === "B") {
    grid[player.y][player.x] = " ";
    collected.B = true;
    lives = Math.min(MAX_LIVES, lives + 1);
    renderLives();
    return;
  }

  if (cell === "A") {
    grid[player.y][player.x] = " ";
    collected.A = true;
    score += 200;
    scoreEl.textContent = String(score);
    updateHigh();
    return;
  }

  if (cell === "H") {
    grid[player.y][player.x] = " ";
    collected.H = true;
    slowUntilMs = nowMs + 6000;
    score += 50;
    scoreEl.textContent = String(score);
    updateHigh();
    return;
  }
}

function resetBoardKeepScore() {
  const keepX = player.x;
  const keepY = player.y;
  const keepDir = { ...player.dir };
  const keepNext = { ...player.next };

  buildGrid();
  addJailToGrid();
  placePowerupsRandom();

  if (!isWall(keepX, keepY)) {
    player.x = keepX;
    player.y = keepY;
    player.dir = keepDir;
    player.next = keepNext;
  } else {
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.dir = { x: 0, y: 0 };
    player.next = { x: 0, y: 0 };
  }

  resetEnemiesSchedule(performance.now());
}

/* Distractions */
const ENEMY_DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function isWallEnemy(x, y, enemy) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;

  const cell = grid[y][x];
  if (cell === "#") return true;

  // after they fully exit, they cannot re enter the jail area
  if (enemy && enemy.noReenter && insideJail(x, y)) return true;

  // gate is allowed
  return false;
}


function enemySpeedMs(nowMs) {
  const base = 230; // slower
  if (nowMs < slowUntilMs) return Math.round(base * 1.55);
  return base;
}

function sameDir(a, b) {
  return a.x === b.x && a.y === b.y;
}

function chooseEnemyDirSmart(e) {
  const options = [];
  for (const d of ENEMY_DIRS) {
    const nx = e.x + d.x;
    const ny = e.y + d.y;
    if (isWallEnemy(nx, ny, e)) continue;
    options.push(d);
  }

  if (options.length === 0) return e.dir;
  if (options.length === 1) return options[0];

  const reverse = { x: -e.dir.x, y: -e.dir.y };
  const usable = options.filter((d) => !sameDir(d, reverse));
  const pool = usable.length ? usable : options;

  // more random while still chasing
  if (Math.random() < 0.25) return pool[Math.floor(Math.random() * pool.length)];

  let best = pool[0];
  let bestScore = Infinity;

  for (const d of pool) {
    const nx = e.x + d.x;
    const ny = e.y + d.y;

    const dist = Math.abs(nx - player.x) + Math.abs(ny - player.y);

    // small penalty if we keep picking the same direction
    const repeatPenalty = e.prevDir && sameDir(d, e.prevDir) ? 0.6 : 0;

    // tiny jitter to prevent ties looping
    const jitter = Math.random() * 0.35;

    const score = dist + repeatPenalty + jitter;

    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }

  e.prevDir = best;
  return best;
}

function moveEnemyOneTile(e) {
  const nx = e.x + e.dir.x;
  const ny = e.y + e.dir.y;
  if (!isWallEnemy(nx, ny, e)) {
    e.x = nx;
    e.y = ny;
    return true;
  }
  return false;
}

function resetEnemiesSchedule(nowMs) {
  const slots = jailSlots();

  enemies = [
    {
      img: enemy1Img,
      x: slots[0].x,
      y: slots[0].y,
      dir: { x: 1, y: 0 },
      lastMove: 0,
      released: false,
      noReenter: false,
      releaseAt: nowMs + 5000,
      prevDir: null,
      attempts: 0,
    },
    {
      img: enemy2Img,
      x: slots[1].x,
      y: slots[1].y,
      dir: { x: -1, y: 0 },
      lastMove: 0,
      released: false,
      noReenter: false,
      releaseAt: nowMs + 10000,
      prevDir: null,
      attempts: 0,
    },
    {
      img: enemy3Img,
      x: slots[2].x,
      y: slots[2].y,
      dir: { x: 1, y: 0 },
      lastMove: 0,
      released: false,
      noReenter: false,
      releaseAt: nowMs + 15000,
      prevDir: null,
      attempts: 0,
    },
  ];
}


function updateEnemies(nowMs) {
  for (const e of enemies) {
    const ms = enemySpeedMs(nowMs);
    if (nowMs - e.lastMove < ms) continue;
    e.lastMove = nowMs;

    const inJailNow = insideJail(e.x, e.y);

    // waiting in jail
    if (!e.released && nowMs < e.releaseAt) {
      const nx = e.x + e.dir.x;
      if (isWallEnemy(nx, e.y, e) || !insideJail(nx, e.y)) {
        e.dir.x *= -1;
      } else {
        e.x = nx;
      }
      continue;
    }

    // release moment
    if (!e.released && nowMs >= e.releaseAt) {
      e.released = true;
    }

    // leaving logic: go to gateMidX, then go up through gate
    if (e.released && inJailNow) {
      if (e.x < gateMidX && !isWallEnemy(e.x + 1, e.y, e)) {
        e.x += 1;
        continue;
      }
      if (e.x > gateMidX && !isWallEnemy(e.x - 1, e.y, e)) {
        e.x -= 1;
        continue;
      }

      // at the gate column, move upward
      if (!isWallEnemy(e.x, e.y - 1, e)) {
        e.y -= 1;
        continue;
      }
    }

    // once outside, lock them from re entering forever
    if (e.released && !inJailNow) {
      e.noReenter = true;
    }

    // roaming logic outside jail
    const dir = chooseEnemyDirSmart(e);
    const nx = e.x + dir.x;
    const ny = e.y + dir.y;

    if (!isWallEnemy(nx, ny, e)) {
      e.x = nx;
      e.y = ny;
      e.dir = dir;
    } else {
      // fallback: try a different smart pick next tick
      e.prevDir = null;
    }
  }
}


function playerHitEnemy() {
  return enemies.some((e) => e.x === player.x && e.y === player.y);
}

/* Game over overlay (safe and only created once) */
let gameOver = false;

const stage =
  document.querySelector(".pmStage") ||
  document.querySelector(".screen") ||
  canvas.parentElement ||
  document.body;

if (getComputedStyle(stage).position === "static") stage.style.position = "relative";

const overlay = document.createElement("div");
overlay.style.position = "absolute";
overlay.style.inset = "0";
overlay.style.display = "none";
overlay.style.alignItems = "center";
overlay.style.justifyContent = "center";
overlay.style.background = "rgba(0,0,0,0.65)";
overlay.style.zIndex = "50";

const card = document.createElement("div");
card.style.padding = "18px 20px";
card.style.borderRadius = "18px";
card.style.background = "rgba(0,0,0,0.75)";
card.style.border = "1px solid rgba(255,255,255,0.2)";
card.style.textAlign = "center";
card.style.minWidth = "260px";

const title = document.createElement("div");
title.textContent = "GAME OVER";
title.style.fontSize = "28px";
title.style.letterSpacing = "2px";
title.style.color = "rgba(247,201,72,0.95)";

const buttons = document.createElement("div");
buttons.style.marginTop = "14px";
buttons.style.display = "flex";
buttons.style.gap = "10px";
buttons.style.justifyContent = "center";

function makeBtn(text) {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.cursor = "pointer";
  b.style.padding = "10px 14px";
  b.style.borderRadius = "12px";
  b.style.border = "1px solid rgba(255,255,255,0.25)";
  b.style.background = "rgba(0,0,0,0.6)";
  b.style.color = "rgba(255,255,255,0.92)";
  return b;
}

if (homeBtnTop) {
  homeBtnTop.onclick = () => (window.location.href = "select.html");
}

const tryAgainBtn = makeBtn("Try Again");
const homeBtn2 = makeBtn("Home");

function showGameOver() {
  gameOver = true;
  overlay.style.display = "flex";
}

function hideGameOver() {
  gameOver = false;
  overlay.style.display = "none";
}

tryAgainBtn.onclick = () => {
  hideGameOver();

  score = 0;
  scoreEl.textContent = "0";

  lives = 3;
  renderLives();

  slowUntilMs = 0;

  buildGrid();
  addJailToGrid();
  placePowerupsRandom();

  player.x = player.spawnX;
  player.y = player.spawnY;
  player.dir = { x: 0, y: 0 };
  player.next = { x: 0, y: 0 };

  resetEnemiesSchedule(performance.now());
};

homeBtn2.onclick = () => {
  window.location.href = "select.html";
};

buttons.appendChild(tryAgainBtn);
buttons.appendChild(homeBtn2);
card.appendChild(title);
card.appendChild(buttons);
overlay.appendChild(card);
stage.appendChild(overlay);

/* Input */
document.addEventListener("keydown", (e) => {
  const d = DIRS[e.key];
  if (!d) return;
  player.next = d;
});

/* Movement */
let lastMove = 0;
const MOVE_MS = 105;

function onPlayerHit(now) {
  lives -= 1;
  renderLives();

  if (lives <= 0) {
    showGameOver();
    return;
  }

  // reset player to spawn on hit
  player.x = player.spawnX;
  player.y = player.spawnY;
  player.dir = { x: 0, y: 0 };
  player.next = { x: 0, y: 0 };

  // full reset of distractions on hit so they go back in jail
  resetEnemiesSchedule(now);
}

function update(now) {
  // enemies update always, but if game over we stop moving
  if (!gameOver) updateEnemies(now);

  if (gameOver) return;

  // grid movement timing
  if (now - lastMove < MOVE_MS) return;
  lastMove = now;

  // try turn first
  const tx = player.x + player.next.x;
  const ty = player.y + player.next.y;
  if (!isWall(tx, ty)) player.dir = player.next;

  // move
  const nx = player.x + player.dir.x;
  const ny = player.y + player.dir.y;

  if (!isWall(nx, ny)) {
    player.x = nx;
    player.y = ny;

    eatPellet();
    collectPowerup(now);
  }

  // collision
  if (playerHitEnemy()) onPlayerHit(now);

  // reset rule
  if (allPelletsGone() && allPowerupsCollected()) {
    resetBoardKeepScore();
  }
}

/* Drawing */
function drawBackdrop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.95)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWallsAndGate() {
  const wallStroke = "rgba(70,170,255,0.95)";
  const wallGlow = "rgba(70,170,255,0.10)";

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== "#") continue;

      const px = x * TILE;
      const py = y * TILE;

      ctx.fillStyle = wallGlow;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

      ctx.strokeStyle = wallStroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
    }
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== "G") continue;

      const px = x * TILE;
      const py = y * TILE;

      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 7);
      ctx.lineTo(px + TILE - 4, py + 7);
      ctx.stroke();
    }
  }
}

function drawPellets() {
  ctx.fillStyle = "rgba(247,201,72,0.95)";
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== ".") continue;

      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFallbackBadge(cx, cy, label) {
  ctx.fillStyle = "rgba(247,201,72,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 0.5);
}

function drawPowerups() {
  ctx.imageSmoothingEnabled = false;
  const size = Math.round(TILE * 2.4);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = grid[y][x];
      if (cell !== "B" && cell !== "A" && cell !== "H") continue;

      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      const px = Math.round(cx - size / 2);
      const py = Math.round(cy - size / 2);

      const img = cell === "B" ? bibleImg : cell === "A" ? appleImg : heartImg;

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, px, py, size, size);
      } else {
        drawFallbackBadge(cx, cy, cell);
      }
    }
  }
}

function drawEnemies() {
  ctx.imageSmoothingEnabled = false;
  const size = Math.round(TILE * 2.1);

  for (const e of enemies) {
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE + TILE / 2;
    const px = Math.round(cx - size / 2);
    const py = Math.round(cy - size / 2);

    if (e.img && e.img.complete && e.img.naturalWidth > 0) {
      ctx.drawImage(e.img, px, py, size, size);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  const cx = player.x * TILE + TILE / 2;
  const cy = player.y * TILE + TILE / 2;

  ctx.imageSmoothingEnabled = false;

  const size = Math.round(TILE * 2.7);
  const px = Math.round(cx - size / 2);
  const py = Math.round(cy - size / 2);

  if (pacboyImg.complete && pacboyImg.naturalWidth > 0) {
    ctx.drawImage(pacboyImg, px, py, size, size);
  } else {
    ctx.fillStyle = "#f7c948";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  drawBackdrop();
  drawWallsAndGate();
  drawPellets();
  drawPowerups();
  drawEnemies();
  drawPlayer();
}

/* Boot */
buildGrid();
addJailToGrid();
placePowerupsRandom();
renderLives();
resetEnemiesSchedule(performance.now());

function loop(now) {
  update(now);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

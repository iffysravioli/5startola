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

// ---------- Score ----------
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

// ---------- Lives ----------
let lives = 3;
const MAX_LIVES = 5;

// ---------- Assets ----------
const pacboyImg = new Image();
pacboyImg.src = "assets/pacboy.png";

const bibleImg = new Image();
bibleImg.src = "assets/powerup1.png";

const appleImg = new Image();
appleImg.src = "assets/powerup2.png";

const heartImg = new Image();
heartImg.src = "assets/powerup3.png";

// ---------- Input ----------
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

// ---------- Maze ----------
const MAZE = [
  "############################",
  "# ...........##............#",
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

function buildGrid() {
  grid = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => (MAZE[y] ? MAZE[y][x] : "#"))
  );
}

// ---------- Jail + gate ----------
function addJailToGrid() {
  const w = 10;
  const h = 5;

  const startX = Math.floor(COLS / 2) - Math.floor(w / 2);
  const startY = Math.floor(ROWS / 2) - Math.floor(h / 2);

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

  // gate on the TOP border (3 tiles)
  const gateY = startY;
  const gateX = startX + Math.floor(w / 2) - 1;
  grid[gateY][gateX] = "G";
  grid[gateY][gateX + 1] = "G";
  grid[gateY][gateX + 2] = "G";

  // clear pellets around jail so it looks clean
  for (let y = startY - 1; y <= startY + h; y++) {
    for (let x = startX - 1; x <= startX + w; x++) {
      if (y < 0 || x < 0 || y >= ROWS || x >= COLS) continue;
      if (grid[y][x] === ".") grid[y][x] = " ";
    }
  }
}

// ---------- Power ups ----------
let slowUntilMs = 0;

function placePowerups() {
  // B bible, A apple, H heart
  const spots = [
    { x: 1, y: 12, t: "B" },
    { x: 26, y: 12, t: "A" },
    { x: 6, y: 3, t: "H" },
  ];

  for (const s of spots) {
    if (!grid[s.y] || !grid[s.y][s.x]) continue;
    if (grid[s.y][s.x] === "#") continue;
    if (grid[s.y][s.x] === "G") continue;
    grid[s.y][s.x] = s.t;
  }
}

function collectPowerup(nowMs) {
  const cell = grid[player.y][player.x];

  if (cell === "B") {
    grid[player.y][player.x] = " ";
    lives = Math.min(MAX_LIVES, lives + 1);
    renderLives();
  }

  if (cell === "A") {
    grid[player.y][player.x] = " ";
    score += 200;
    scoreEl.textContent = String(score);
    updateHigh();
  }

  if (cell === "H") {
    grid[player.y][player.x] = " ";
    slowUntilMs = nowMs + 6000;
    score += 50;
    scoreEl.textContent = String(score);
    updateHigh();
  }
}

// ---------- Player ----------
const player = {
  x: 1,
  y: 1,
  dir: { x: 0, y: 0 },
  next: { x: 0, y: 0 },
  spawnX: 1,
  spawnY: 1,
};

// ---------- Helpers ----------
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

// ---------- Input ----------
document.addEventListener("keydown", (e) => {
  const d = DIRS[e.key];
  if (!d) return;
  player.next = d;
});

// ---------- Movement ----------
let lastMove = 0;
const MOVE_MS = 105;

function update(now) {
  if (now - lastMove < MOVE_MS) return;
  lastMove = now;

  const tx = player.x + player.next.x;
  const ty = player.y + player.next.y;
  if (!isWall(tx, ty)) player.dir = player.next;

  const nx = player.x + player.dir.x;
  const ny = player.y + player.dir.y;

  if (!isWall(nx, ny)) {
    player.x = nx;
    player.y = ny;

    eatPellet();
    collectPowerup(now);
  }
}

// ---------- Drawing ----------
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

  // gate bars
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
  const size = Math.round(TILE * 2.2);

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
  drawPlayer();
}

// ---------- Boot ----------
buildGrid();
addJailToGrid();
placePowerups();
renderLives();

function loop(now) {
  update(now);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

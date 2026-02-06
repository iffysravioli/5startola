const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");

const TILE = 26;
const COLS = 28;
const ROWS = 21;

// ---------- Score ----------
let score = 0;
let high = Number(localStorage.getItem("bb_high") || 0);
scoreEl.textContent = "0";
highEl.textContent = String(high);

// ---------- Assets ----------
const pacboyImg = new Image();
pacboyImg.src = "assets/pacboy.png";
pacboyImg.onload = () => console.log("pacboy loaded", pacboyImg.naturalWidth, pacboyImg.naturalHeight);
pacboyImg.onerror = () => console.log("pacboy failed to load. check assets/pacboy.png");

// ---------- Input ----------
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

// ---------- Maze (simple) ----------
const MAZE = [
  "############################",
  "# ...........##............#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####....#####.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.......##.......####.#",
  "#............##............#",
  "############################",
];


const grid = Array.from({ length: ROWS }, (_, y) =>
  Array.from({ length: COLS }, (_, x) => (MAZE[y] ? MAZE[y][x] : "#"))
);

// ---------- Center "distraction box" with visible gate ----------
function addJailToGrid() {
  const w = 10; // tiles wide
  const h = 6;  // tiles tall

  const startX = Math.floor(COLS / 2) - Math.floor(w / 2);
  const startY = Math.floor(ROWS / 2) - Math.floor(h / 2);

  // build box
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

  // gate (3 tiles) on the TOP border, centered
  const gateY = startY;
  const gateX1 = startX + Math.floor(w / 2) - 1;
  grid[gateY][gateX1] = "G";
  grid[gateY][gateX1 + 1] = "G";
  grid[gateY][gateX1 + 2] = "G";

  // clear pellets around the box so it looks clean
  for (let y = startY - 1; y <= startY + h; y++) {
    for (let x = startX - 1; x <= startX + w; x++) {
      if (y < 0 || x < 0 || y >= ROWS || x >= COLS) continue;
      if (grid[y][x] === ".") grid[y][x] = " ";
    }
  }
}

addJailToGrid();

// ---------- Player ----------
const player = {
  x: 1,
  y: 1,
  dir: { x: 0, y: 0 },
  next: { x: 0, y: 0 },
};

// ---------- Helpers ----------
function isWall(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return grid[y][x] === "#" || grid[y][x] === "G";
}

function eatPellet() {
  if (grid[player.y][player.x] === ".") {
    grid[player.y][player.x] = " ";
    score += 10;
    scoreEl.textContent = String(score);

    if (score > high) {
      high = score;
      localStorage.setItem("bb_high", String(high));
      highEl.textContent = String(high);
    }
  }
}

// ---------- Input events ----------
document.addEventListener("keydown", (e) => {
  const d = DIRS[e.key];
  if (!d) return;
  player.next = d;
});

// ---------- Movement (grid snap) ----------
let lastMove = 0;
const MOVE_MS = 105;

function update(now) {
  if (now - lastMove < MOVE_MS) return;
  lastMove = now;

  // turn first if possible
  const tx = player.x + player.next.x;
  const ty = player.y + player.next.y;
  if (!isWall(tx, ty)) player.dir = player.next;

  // then move 1 tile
  const nx = player.x + player.dir.x;
  const ny = player.y + player.dir.y;
  if (!isWall(nx, ny)) {
    player.x = nx;
    player.y = ny;
    eatPellet();
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

  // walls
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

  // gate tiles (thin bars)
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
  // GOLD pellets
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

function drawPlayer() {
  const cx = player.x * TILE + TILE / 2;
  const cy = player.y * TILE + TILE / 2;

  ctx.imageSmoothingEnabled = false;

  // BIG pacboy
  const size = Math.round(TILE * 2.6);
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
  drawPlayer();
}

// ---------- Loop ----------
function loop(now) {
  update(now);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

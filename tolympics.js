/* =========================================================================
   TOLYMPICS - Sand Pit Climber
   Doodle-Jump-style vertical climber with a triple-jump theme: gravity
   constantly pulls you down, and you automatically bounce upward whenever
   you land on top of a floating sand pit. The only control is steering left
   / right (screen wraps around the edges) - there is no jump button, just
   like the classic. Climb as high as you can; fall off the bottom of the
   screen and the run ends. Score = height climbed, medals at score
   thresholds, best score saved.
   ========================================================================= */

/* ------------------------------------------------------------------ DOM -- */
const loadingScreen = document.getElementById("loadingScreen");
const loadingBarFill = document.getElementById("loadingBarFill");
const loadingText = document.getElementById("loadingText");
const gameWrap = document.getElementById("gameWrap");
const homeBtn = document.getElementById("homeBtn");

const startPanel = document.getElementById("startPanel");
const startBtn = document.getElementById("startBtn");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultIcon = document.getElementById("resultIcon");
const resultScore = document.getElementById("resultScore");
const resultNote = document.getElementById("resultNote");
const retryBtn = document.getElementById("retryBtn");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const bigMessage = document.getElementById("bigMessage");

const W = canvas.width;
const H = canvas.height;

homeBtn.addEventListener("click", () => { window.location.href = "select.html"; });

/* ---------------------------------------------------------- persistence -- */
let best = Number(localStorage.getItem("tolympics_best_score") || 0);

/* --------------------------------------------------------- game state --- */
let gameState = "loading"; // loading | ready | playing | gameover
let score = 0;
let climbed = 0;          // total world-height climbed, drives score + scrolling

let now = performance.now();
let last = now;

/* ------------------------------------------------------------- player --- */
const GRAVITY = 0.42;
const HOP_POWER = 13.5;
const H_ACCEL = 1.4;
const H_MAX = 9.5;
const H_FRICTION = 0.90;

const player = {
  x: W / 2,
  y: H - 140,
  w: 24,
  h: 40,
  vx: 0,
  vy: 0,
  facing: 1,
};

const keys = new Set();
let touchDir = 0; // -1 left, 0 none, 1 right (from click/tap steering)

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (e.key === " ") {
    if (gameState === "ready") startRun();
    else if (gameState === "gameover" && resultReady) startRun();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key));

canvas.addEventListener("mousedown", (e) => {
  if (gameState === "ready") { startRun(); return; }
  if (gameState === "gameover") { if (resultReady) startRun(); return; }
  const rect = canvas.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;
  touchDir = relX < 0.5 ? -1 : 1;
});
window.addEventListener("mouseup", () => { touchDir = 0; });
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (gameState === "ready") { startRun(); return; }
  if (gameState === "gameover") { if (resultReady) startRun(); return; }
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const relX = (t.clientX - rect.left) / rect.width;
  touchDir = relX < 0.5 ? -1 : 1;
}, { passive: false });
window.addEventListener("touchend", () => { touchDir = 0; });

startBtn.addEventListener("click", () => { if (gameState === "ready") startRun(); });
retryBtn.addEventListener("click", () => { if (gameState === "gameover") startRun(); });

let resultReady = false;

/* ----------------------------------------------------- sprite animator -- */
const spriteSheet = new Image();
const SPRITE_CFG = window.TOLYMPICS_SPRITE_CONFIG || null;

class SpriteAnimator {
  constructor(image, config) {
    this.image = image;
    this.config = config;
    this.current = "idle";
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
  }
  play(name, opts = {}) {
    if (!this.config || !this.config.animations[name]) return;
    if (this.current === name && !opts.force) return;
    this.current = name;
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
  }
  update(dt) {
    if (!this.config) return;
    const anim = this.config.animations[this.current];
    if (!anim) return;
    this.timer += dt;
    const frameDur = 1 / anim.fps;
    while (this.timer >= frameDur) {
      this.timer -= frameDur;
      this.frameIndex++;
      if (this.frameIndex >= anim.frameCount) {
        if (anim.loop) { this.frameIndex = 0; }
        else { this.frameIndex = anim.frameCount - 1; this.finished = true; }
      }
    }
  }
  draw(context, x, y, w, h, flip) {
    if (!this.config) return;
    const anim = this.config.animations[this.current];
    if (!anim) return;
    const fw = this.config.frameWidth, fh = this.config.frameHeight;
    const sx = (anim.startFrame + this.frameIndex) * fw;
    const sy = anim.row * fh;
    if (flip) {
      context.save();
      context.translate(x + w, y);
      context.scale(-1, 1);
      context.drawImage(this.image, sx, sy, fw, fh, 0, 0, w, h);
      context.restore();
    } else {
      context.drawImage(this.image, sx, sy, fw, fh, x, y, w, h);
    }
  }
}

const animator = new SpriteAnimator(spriteSheet, SPRITE_CFG);
const SPR_ASPECT = SPRITE_CFG ? SPRITE_CFG.frameWidth / SPRITE_CFG.frameHeight : 1.12;
const SPR_DRAW_H = 66;
const SPR_DRAW_W = Math.round(SPR_DRAW_H * SPR_ASPECT);
const SPR_GROUND_FRAC = SPRITE_CFG ? SPRITE_CFG.groundLine / SPRITE_CFG.frameHeight : 0.94;

/* ------------------------------------------------------------- audio ---- */
const AUDIO_BASE = "assets/tolympics/audio/";
const sounds = {
  jump: new Audio(AUDIO_BASE + "jump.wav"),
  land: new Audio(AUDIO_BASE + "land.wav"),
  cheer: new Audio(AUDIO_BASE + "crowd_cheer.wav"),
  foul: new Audio(AUDIO_BASE + "foul_whistle.wav"),
  pb: new Audio(AUDIO_BASE + "personal_best.wav"),
};
Object.values(sounds).forEach((a) => { a.preload = "auto"; a.volume = 0.6; });

function playSfx(name, volume) {
  const base = sounds[name];
  if (!base) return;
  try {
    const inst = base.cloneNode();
    inst.volume = volume != null ? volume : base.volume;
    inst.play().catch(() => {});
  } catch (e) { /* ignore autoplay/errors */ }
}

/* --------------------------------------------------------- loading ------ */
let assetsLoaded = 0;
let assetsTotal = 2;
const loadStart = performance.now();
const MIN_LOAD_MS = 700;

function bumpLoad() {
  assetsLoaded++;
  loadingBarFill.style.width = Math.min(100, Math.round((assetsLoaded / assetsTotal) * 100)) + "%";
  if (assetsLoaded >= assetsTotal) finishLoading();
}

function finishLoading() {
  const wait = Math.max(0, MIN_LOAD_MS - (performance.now() - loadStart));
  setTimeout(() => {
    loadingScreen.classList.add("hidden");
    gameWrap.classList.remove("hidden");
    gameState = "ready";
    resetWorld();
    requestAnimationFrame(loop);
  }, wait);
}

spriteSheet.onload = bumpLoad;
spriteSheet.onerror = bumpLoad;
spriteSheet.src = "assets/tolympics/sprites/player_spritesheet.png";
loadingText.textContent = SPRITE_CFG ? "LOADING…" : "LOADING (no sprite config found)…";
bumpLoad();

/* ------------------------------------------------------------- helpers -- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function px(v) { return Math.round(v); }

let bigMsgTimer = null;
function showBigMessage(text, cls, duration) {
  bigMessage.textContent = text;
  bigMessage.className = "bigMessage " + cls;
  bigMessage.classList.remove("hidden");
  void bigMessage.offsetWidth;
  bigMessage.style.animation = "none";
  void bigMessage.offsetWidth;
  bigMessage.style.animation = "";
  clearTimeout(bigMsgTimer);
  bigMsgTimer = setTimeout(() => bigMessage.classList.add("hidden"), duration || 700);
}

const particles = [];
function spawnSandBurst(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2.4,
      life: 1,
      color: Math.random() < 0.5 ? "#caa66c" : "#e6cf9a",
    });
  }
}

let shakeMag = 0;
function triggerShake(m) { shakeMag = Math.max(shakeMag, m); }

/* ----------------------------------------------------------- platforms -- */
const PIT_W = 76;          // easiest/starting platform width
const PIT_W_HARD = 50;     // narrowest platform width once fully ramped up
const PIT_H = 20;
// kept safely under the true max jump height (see maxJumpHeight below) so
// every pit is always within reach - no more guessing
const SPACING_MIN = 70;
const SPACING_MAX = 150;
const SPACING_MIN_HARD = 100;
const SPACING_MAX_HARD = 190;   // still ~27px under max jump height at full difficulty
const LAND_FORGIVENESS = 6;

function maxJumpHeight() {
  return (HOP_POWER * HOP_POWER) / (2 * GRAVITY);
}

// 0 at the start, ramps up to 1 by ~120 points and stays there - the run
// keeps getting tighter (closer platforms spacing-wise, narrower targets,
// less margin for error) the higher you climb
function difficultyT() {
  return clamp(score / 120, 0, 1);
}

function horizontalDistanceInTime(t) {
  // exact distance covered accelerating from a standstill at H_ACCEL up to
  // H_MAX, then holding H_MAX - accounts for the accel ramp-up instead of
  // (wrongly) assuming full speed is instant, so this is never an overestimate
  const tRamp = H_MAX / H_ACCEL;
  if (t <= tRamp) return 0.5 * H_ACCEL * t * t;
  return H_MAX * t - 0.5 * (H_MAX * H_MAX) / H_ACCEL;
}

function reachableHorizontal(dy, factor) {
  // how far sideways the player can realistically drift while rising `dy`
  // px, given how much time that takes and how fast he can steer - this is
  // what keeps every generated pit honestly reachable. `factor` is how much
  // of that theoretical maximum we actually use when placing a pit - higher
  // factor = the game asks for closer-to-perfect steering.
  const disc = HOP_POWER * HOP_POWER - 2 * GRAVITY * dy;
  if (disc <= 0) return 45;
  const t = (HOP_POWER - Math.sqrt(disc)) / GRAVITY;
  return Math.max(45, horizontalDistanceInTime(t) * factor);
}

// drift state biases a run of several pits the same direction (instead of a
// small symmetric wobble that tends to hug the middle of the screen), so the
// ladder actually swings across the full width over time
let driftDir = 1;
let driftStepsLeft = 0;

function resetDrift() {
  driftDir = Math.random() < 0.5 ? -1 : 1;
  driftStepsLeft = 3 + Math.floor(Math.random() * 4);
}

function nextPitPosition(prevY, prevX) {
  const t = difficultyT();
  const spacingMin = SPACING_MIN + (SPACING_MIN_HARD - SPACING_MIN) * t;
  const spacingMax = SPACING_MAX + (SPACING_MAX_HARD - SPACING_MAX) * t;
  const dy = spacingMin + Math.random() * (spacingMax - spacingMin);
  const y = prevY - dy;
  const reachFactor = 0.82 + (0.98 - 0.82) * t;
  const reach = reachableHorizontal(dy, reachFactor);
  const w = PIT_W + (PIT_W_HARD - PIT_W) * t;
  const margin = w / 2 + 10;

  if (driftStepsLeft <= 0) resetDrift();
  driftStepsLeft--;

  let x = prevX + driftDir * reach * (0.5 + Math.random() * 0.5);
  if (x < margin || x > W - margin) driftDir *= -1; // bounce back inward off the wall
  x = clamp(x, margin, W - margin);
  return { x, y, w };
}

let pits = [];
let pickups = [];
let highestPitY = 0;
let lastPitX = 0;

function seedPits() {
  pits = [];
  pickups = [];
  resetDrift();
  // a safe starting pit right under the player, then a climbable ladder above it
  const startY = H - 90;
  pits.push({ x: player.x, y: startY, w: PIT_W, scored: true });
  let prevY = startY, prevX = player.x;
  while (prevY > -200) {
    const { x, y, w } = nextPitPosition(prevY, prevX);
    pits.push({ x, y, w, scored: false });
    maybeSpawnPickup(x, y);
    prevY = y; prevX = x;
  }
  highestPitY = prevY;
  lastPitX = prevX;
}

function extendPitsIfNeeded() {
  while (highestPitY > -200) {
    const { x, y, w } = nextPitPosition(highestPitY, lastPitX);
    pits.push({ x, y, w, scored: false });
    maybeSpawnPickup(x, y);
    highestPitY = y; lastPitX = x;
  }
}

/* ------------------------------------------------------------ pickups --- */
// Bible = 10s of free flight (auto-climb, ignores needing to land on pits)
// Gatorade = one free save if you fall past the pits
// Computer = instant bonus points
const PICKUP_SIZE = 22;
const FLIGHT_SPEED = 6.6;
let flightTimer = 0;
let extraLives = 0;

function maybeSpawnPickup(x, y) {
  const roll = Math.random();
  let type = null;
  if (roll < 0.02) type = "bible";
  else if (roll < 0.02 + 0.045) type = "gatorade";
  else if (roll < 0.02 + 0.045 + 0.06) type = "computer";
  if (!type) return;
  pickups.push({ type, x, y: y - 36, taken: false });
}

function collectPickup(pu) {
  pu.taken = true;
  spawnSandBurst(pu.x, pu.y, 10);
  if (pu.type === "bible") {
    flightTimer = 10;
    showBigMessage("FLIGHT!", "msgPB", 900);
    playSfx("pb", 0.7);
    animator.play("celebrate", { force: true });
  } else if (pu.type === "gatorade") {
    extraLives += 1;
    showBigMessage("+1 LIFE", "msgPoint", 800);
    playSfx("cheer", 0.5);
  } else if (pu.type === "computer") {
    score += 12;
    showBigMessage("+12", "msgPoint", 600);
    playSfx("jump", 0.5);
  }
}

function updatePickups() {
  for (const pu of pickups) {
    if (pu.taken) continue;
    if (Math.abs(player.x - pu.x) < PICKUP_SIZE * 0.9 &&
        Math.abs((player.y + player.h / 2) - pu.y) < PICKUP_SIZE * 0.9) {
      collectPickup(pu);
    }
  }
  pickups = pickups.filter((p) => !p.taken && p.y < H + 60);
}

/* --------------------------------------------------------- game flow ---- */
function resetWorld() {
  score = 0;
  climbed = 0;
  player.x = W / 2;
  player.y = H - 140;
  player.vx = 0;
  player.vy = 0;
  particles.length = 0;
  shakeMag = 0;
  flightTimer = 0;
  extraLives = 0;
  seedPits();
  animator.play("idle", { force: true });
  startPanel.classList.remove("hidden");
  resultPanel.classList.add("hidden");
}

function startRun() {
  gameState = "playing";
  resultReady = false;
  score = 0;
  climbed = 0;
  player.x = W / 2;
  player.y = H - 140;
  player.vx = 0;
  player.vy = -HOP_POWER; // first bounce, so the run opens already in motion
  flightTimer = 0;
  extraLives = 0;
  seedPits();
  startPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  animator.play("hop", { force: true });
  playSfx("jump", 0.55);
}

function finalizeGameOver() {
  gameState = "gameover";
  animator.play("foul", { force: true });
  playSfx("foul", 0.8);
  triggerShake(8);
  spawnSandBurst(player.x, H - 30, 16);
  showBigMessage("FELL!", "msgFoul", 900);

  const isPB = score > best;
  if (isPB) {
    best = score;
    localStorage.setItem("tolympics_best_score", String(best));
  }

  let icon = "🎽", note = "Keep climbing to reach the podium!";
  if (score >= 60) { icon = "🥇"; note = "GOLD! Incredible climb!"; playSfx("cheer", 0.7); }
  else if (score >= 35) { icon = "🥈"; note = "SILVER! So close to gold."; playSfx("cheer", 0.5); }
  else if (score >= 15) { icon = "🥉"; note = "BRONZE! Nice run."; }

  resultTitle.textContent = isPB ? "NEW BEST!" : "GAME OVER";
  resultIcon.textContent = icon;
  resultScore.textContent = String(score);
  resultNote.textContent = note;

  setTimeout(() => {
    resultPanel.classList.remove("hidden");
    resultReady = true;
    if (isPB) playSfx("pb", 0.8);
  }, 500);
}

/* --------------------------------------------------------------- physics */
function physics(dt) {
  const scale = dt * 60;

  const left = keys.has("ArrowLeft") || touchDir < 0;
  const right = keys.has("ArrowRight") || touchDir > 0;
  if (left) { player.vx -= H_ACCEL * scale; player.facing = -1; }
  else if (right) { player.vx += H_ACCEL * scale; player.facing = 1; }
  else { player.vx *= Math.pow(H_FRICTION, scale); }
  player.vx = clamp(player.vx, -H_MAX, H_MAX);
  player.x += player.vx * scale;

  // wrap around the sides, classic Doodle Jump style (player.x is his center)
  const halfW = player.w / 2;
  if (player.x < -halfW) player.x = W + halfW;
  if (player.x > W + halfW) player.x = -halfW;

  if (flightTimer > 0) {
    // Bible power-up: free flight, ignores gravity and pits entirely
    flightTimer = Math.max(0, flightTimer - dt);
    player.vy = -FLIGHT_SPEED;
    player.y += player.vy * scale;
    if (flightTimer === 0) {
      player.vy = 0;
      animator.play("hop", { force: true });
    }
  } else {
    const prevFootY = player.y + player.h;
    player.vy += GRAVITY * scale;
    player.y += player.vy * scale;
    const footY = player.y + player.h;

    if (player.vy > 0) {
      for (const p of pits) {
        // player.x is his horizontal center - land if that center is over the
        // pit (plus a little forgiveness on each side, easier to line up)
        const withinX = player.x > p.x - p.w / 2 - LAND_FORGIVENESS && player.x < p.x + p.w / 2 + LAND_FORGIVENESS;
        if (withinX && prevFootY <= p.y + 4 && footY >= p.y) {
          player.y = p.y - player.h;
          player.vy = -HOP_POWER;
          animator.play("hop", { force: true });
          playSfx("jump", 0.5);
          spawnSandBurst(player.x, p.y, 6);
          if (!p.scored) {
            p.scored = true;
            score += 1;
            if (score % 10 === 0) playSfx("cheer", 0.45);
          }
          break;
        }
      }
    }
  }

  updatePickups();

  // scroll the world up (ratchet - never scrolls back down) once the player
  // climbs above the upper third of the screen
  const scrollLine = H * 0.38;
  if (player.y < scrollLine) {
    const shift = scrollLine - player.y;
    player.y = scrollLine;
    climbed += shift;
    score = Math.max(score, Math.floor(climbed / 6));
    for (const p of pits) p.y += shift;
    for (const pu of pickups) pu.y += shift;
    highestPitY += shift;
    for (const part of particles) part.y += shift;
    extendPitsIfNeeded();
  }

  pits = pits.filter((p) => p.y < H + 60);

  if (player.y > H + 40) {
    if (extraLives > 0) {
      extraLives -= 1;
      player.y = scrollLine - 10;
      player.vy = -HOP_POWER;
      showBigMessage("SAVED!", "msgPB", 900);
      playSfx("cheer", 0.6);
      animator.play("hop", { force: true });
    } else {
      finalizeGameOver();
    }
  }
}

/* --------------------------------------------------------------- draw --- */
function rect(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#2c7fe0");
  grad.addColorStop(1, "#bfe4f7");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 5; i++) {
    const cx = (i * 210 + 60) % (W + 160) - 80;
    const cy = ((i * 160 + climbed * 0.2) % (H + 160)) - 80;
    rect(cx, cy, 42, 10, "rgba(255,255,255,0.85)");
    rect(cx + 9, cy - 6, 24, 10, "rgba(255,255,255,0.85)");
  }
}

function drawPit(p) {
  rect(p.x - p.w / 2 - 3, p.y - 3, p.w + 6, PIT_H + 6, "#5a4326");
  rect(p.x - p.w / 2, p.y, p.w, PIT_H, "#d8b877");
  rect(p.x - p.w / 2 + 4, p.y + PIT_H - 5, p.w - 8, 3, "rgba(0,0,0,0.15)");
}

function drawPits() {
  for (const p of pits) drawPit(p);
}

function drawBibleIcon(x, y) {
  rect(x - 9, y - 11, 18, 22, "#7a2323");
  rect(x - 9, y - 11, 18, 3, "#5a1818");
  rect(x - 1, y - 7, 2, 14, "#f2d98a");
  rect(x - 4, y - 3, 8, 2, "#f2d98a");
}

function drawGatoradeIcon(x, y) {
  rect(x - 6, y - 13, 12, 4, "#e9e9e9");
  rect(x - 8, y - 9, 16, 20, "#ff9f1c");
  rect(x - 8, y - 2, 16, 3, "#ffffff");
}

function drawComputerIcon(x, y) {
  rect(x - 10, y - 9, 20, 14, "#1a1a1f");
  rect(x - 8, y - 7, 16, 10, "#5ad1ff");
  rect(x - 12, y + 5, 24, 4, "#3a3a40");
}

function drawPickups() {
  for (const pu of pickups) {
    if (pu.taken) continue;
    if (pu.type === "bible") drawBibleIcon(pu.x, pu.y);
    else if (pu.type === "gatorade") drawGatoradeIcon(pu.x, pu.y);
    else if (pu.type === "computer") drawComputerIcon(pu.x, pu.y);
  }
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.15 * dt * 60;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= dt * 1.6;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillRect(px(p.x), px(p.y), 3, 3);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer() {
  const flip = player.facing < 0;
  if (SPRITE_CFG && spriteSheet.complete && spriteSheet.naturalWidth > 0) {
    const drawX = player.x - SPR_DRAW_W / 2;
    const drawY = (player.y + player.h) - SPR_DRAW_H * SPR_GROUND_FRAC;
    animator.draw(ctx, drawX, drawY, SPR_DRAW_W, SPR_DRAW_H, flip);
  } else {
    rect(player.x - 12, player.y, 24, 40, "#f7f5ff");
  }
}

function drawScoreText(text, x, y, size) {
  ctx.font = `900 ${size}px monospace`;
  ctx.textAlign = "left";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
}

function drawScore() {
  if (gameState === "loading") return;
  drawScoreText(String(score), 20, 46, 34);
  drawScoreText("BEST " + best, 20, 70, 14);
  let y = 92;
  if (flightTimer > 0) { drawScoreText("FLYING " + Math.ceil(flightTimer) + "s", 20, y, 14); y += 20; }
  if (extraLives > 0) { drawScoreText("SAVES x" + extraLives, 20, y, 14); y += 20; }
}

/* --------------------------------------------------------------- loop --- */
function updateAnimation() {
  if (gameState === "ready") animator.play("idle");
  else if (gameState === "gameover") { if (animator.current !== "foul") animator.play("foul", { force: true }); }
}

function loop(ts) {
  now = ts || performance.now();
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  if (gameState === "playing") physics(dt);

  updateAnimation();
  animator.update(dt);

  ctx.save();
  if (shakeMag > 0.05) {
    ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    shakeMag *= Math.pow(0.85, dt * 60);
  } else {
    shakeMag = 0;
  }

  drawSky();
  drawPits();
  drawPickups();
  drawPlayer();
  drawParticles(dt);

  ctx.restore();

  drawScore();

  requestAnimationFrame(loop);
}

/* loop starts once assets finish loading (see finishLoading above) */

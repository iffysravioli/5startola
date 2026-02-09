document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const homeBtn = document.getElementById("homeBtn");
  const resetBtn = document.getElementById("resetBtn");

  const turnPill = document.getElementById("turnPill");
  const statusPill = document.getElementById("statusPill");
  const pScoreEl = document.getElementById("pScore");
  const wScoreEl = document.getElementById("wScore");
  const pLabel = document.getElementById("pLabel");
  const wLabel = document.getElementById("wLabel");

  const startModal = document.getElementById("startModal");
  const startPurple = document.getElementById("startPurple");
  const startWhite = document.getElementById("startWhite");
  const startBtn = document.getElementById("startBtn");

  const winModal = document.getElementById("winModal");
  const winTitle = document.getElementById("winTitle");
  const winSub = document.getElementById("winSub");
  const playAgainBtn = document.getElementById("playAgainBtn");

  const COLS = 7;
  const ROWS = 6;

  const PURPLE = 1;
  const WHITE = 2;

  let board = [];
  let current = PURPLE;
  let locked = false;
  let started = false;

  let pScore = 0;
  let wScore = 0;

  let pName = "PURPLE";
  let wName = "WHITE";

  const purpleImg = new Image();
  purpleImg.src = "assets/purplebb.png";

  const whiteImg = new Image();
  whiteImg.src = "assets/whitebb.png";

  function cleanName(v, fallback) {
    const s = String(v || "").trim();
    if (!s) return fallback;
    return s.slice(0, 12);
  }

  function applyNames() {
    pName = cleanName(startPurple ? startPurple.value : "", "PURPLE").toUpperCase();
    wName = cleanName(startWhite ? startWhite.value : "", "WHITE").toUpperCase();

    if (pLabel) pLabel.textContent = pName;
    if (wLabel) wLabel.textContent = wName;

    setTurnText();
  }

  function openStartModal() {
    started = false;
    locked = true;
    if (startModal) startModal.classList.remove("hidden");
    setStatus("ENTER NAMES TO START");
  }

  function closeStartModal() {
    if (startModal) startModal.classList.add("hidden");
  }

  function showWinModal(winner) {
    if (!winModal) return;
    if (winTitle) winTitle.textContent = `${winner} WINS`;
    if (winSub) winSub.textContent = "CONNECT 4";
    winModal.classList.remove("hidden");
  }

  function hideWinModal() {
    if (!winModal) return;
    winModal.classList.add("hidden");
    if (winSub) winSub.textContent = "CONNECT 4";
  }

  function setTurnText() {
    if (!turnPill) return;
    const who = current === PURPLE ? pName : wName;
    turnPill.textContent = `TURN: ${who}`;
  }

  function setStatus(t) {
    if (!statusPill) return;
    statusPill.textContent = t;
  }

  function initBoardOnly() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    current = PURPLE;
    locked = !started;
    hideWinModal();
    setTurnText();
    draw();
  }

  function startGame() {
    applyNames();
    started = true;
    locked = false;
    closeStartModal();
    initBoardOnly();
    setStatus("FIRST TO CONNECT 4");
  }

  function metrics() {
    const pad = 30;
    const cell = Math.floor(
      Math.min(
        (canvas.width - pad * 2) / COLS,
        (canvas.height - pad * 2) / ROWS
      )
    );

    const boardW = cell * COLS;
    const boardH = cell * ROWS;

    const x0 = Math.floor((canvas.width - boardW) / 2);

    const y0Raw = Math.floor((canvas.height - boardH) / 2) - 24;
    const y0 = Math.max(18, y0Raw);

    return { cell, boardW, boardH, x0, y0 };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { cell, boardW, boardH, x0, y0 } = metrics();

    drawCourtGlow();
    drawBoardOutline(x0, y0, boardW, boardH);
    drawRimAndNet(x0, y0, boardW, boardH);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = x0 + c * cell + cell / 2;
        const cy = y0 + r * cell + cell / 2;

        drawSlotOutline(cx, cy, cell * 0.84);

        const v = board[r][c];
        if (v === PURPLE) drawPieceImage(cx, cy, cell * 0.86, purpleImg);
        if (v === WHITE) drawPieceImage(cx, cy, cell * 0.86, whiteImg);
      }
    }
  }

  function drawCourtGlow() {
    ctx.save();
    const g = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      30,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width
    );
    g.addColorStop(0, "rgba(76,201,255,0.08)");
    g.addColorStop(0.55, "rgba(122,44,255,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawBoardOutline(x, y, w, h) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(x - 18, y - 18, w + 36, h + 36, 20);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    roundRect(x - 18, y - 18, w + 36, h + 36, 20);
    ctx.stroke();

    ctx.strokeStyle = "rgba(122,44,255,0.20)";
    ctx.lineWidth = 2;
    roundRect(x - 10, y - 10, w + 20, h + 20, 18);
    ctx.stroke();

    ctx.restore();
  }

  function drawRimAndNet(x0, y0, w, h) {
    const rimY = y0 + h + 8;
    const rimX1 = x0 + w * 0.22;
    const rimX2 = x0 + w * 0.78;

    ctx.save();

    ctx.strokeStyle = "rgba(247,201,72,0.55)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rimX1, rimY);
    ctx.lineTo(rimX2, rimY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;

    const netTop = rimY + 6;
    const netBottom = rimY + 48;
    const steps = 10;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = rimX1 + (rimX2 - rimX1) * t;
      ctx.beginPath();
      ctx.moveTo(x, netTop);
      ctx.lineTo(x + (t - 0.5) * 10, netBottom);
      ctx.stroke();
    }

    for (let j = 0; j <= 5; j++) {
      const t = j / 5;
      const y = netTop + (netBottom - netTop) * t;
      ctx.beginPath();
      ctx.moveTo(rimX1 + 6, y);
      ctx.lineTo(rimX2 - 6, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSlotOutline(cx, cy, size) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(122,44,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function drawPieceImage(cx, cy, size, img) {
    if (!img || !img.complete) return;

    const s = size;
    const x = cx - s / 2;
    const y = cy - s / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(img, x, y, s, s);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function colFromClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);

    const { cell, x0 } = metrics();
    const col = Math.floor((x - x0) / cell);
    if (col < 0 || col >= COLS) return null;
    return col;
  }

  function dropRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) return r;
    }
    return null;
  }

  function checkDraw() {
    for (let c = 0; c < COLS; c++) {
      if (board[0][c] === 0) return false;
    }
    return true;
  }

  function checkWin(player) {
    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== player) continue;

        for (const d of dirs) {
          let count = 1;
          for (let k = 1; k < 4; k++) {
            const rr = r + d.dr * k;
            const cc = c + d.dc * k;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
            if (board[rr][cc] !== player) break;
            count++;
          }
          if (count >= 4) return true;
        }
      }
    }
    return false;
  }

  function handleMove(col) {
    if (!started) return;
    if (locked) return;

    const r = dropRow(col);
    if (r === null) {
      setStatus("THAT COLUMN IS FULL");
      return;
    }

    board[r][col] = current;

    if (checkWin(current)) {
      locked = true;
      const winner = current === PURPLE ? pName : wName;

      setStatus(`${winner} WINS`);

      if (current === PURPLE) pScore++;
      else wScore++;

      if (pScoreEl) pScoreEl.textContent = String(pScore);
      if (wScoreEl) wScoreEl.textContent = String(wScore);

      draw();
      showWinModal(winner);
      return;
    }

    if (checkDraw()) {
      locked = true;
      setStatus("DRAW GAME");
      draw();

      showWinModal("NO ONE");
      if (winSub) winSub.textContent = "DRAW GAME";
      return;
    }

    current = current === PURPLE ? WHITE : PURPLE;
    setTurnText();
    setStatus("SHOOT YOUR BALL");
    draw();
  }

  canvas.addEventListener("click", (e) => {
    const col = colFromClick(e);
    if (col === null) return;
    handleMove(col);
  });

  if (startBtn) {
    startBtn.addEventListener("click", () => startGame());
  }

  if (startWhite) {
    startWhite.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startGame();
    });
  }

  if (startPurple) {
    startPurple.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startGame();
    });
  }

  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "select.html";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      initBoardOnly();
      if (started) setStatus("FIRST TO CONNECT 4");
      if (!started) openStartModal();
    });
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      hideWinModal();
      initBoardOnly();
      if (started) setStatus("FIRST TO CONNECT 4");
    });
  }

  if (winModal) {
    winModal.addEventListener("click", (e) => {
      if (e.target === winModal) hideWinModal();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      initBoardOnly();
      if (started) setStatus("FIRST TO CONNECT 4");
    }
    if (e.key === "Escape") {
      hideWinModal();
    }
  });

  applyNames();
  initBoardOnly();
  openStartModal();
});

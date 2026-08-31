(function(){
  "use strict";

  // ---------------- SOUND (procedural, no audio files) ----------------
  const SFX = (function(){
    let ctx = null;
    function ensureCtx(){
      if(!ctx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return null;
        ctx = new AC();
      }
      if(ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, opts){
      const c = ensureCtx();
      if(!c) return;
      const { duration=0.12, type="sine", volume=0.2, delay=0, glideTo=null } = opts || {};
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if(glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0+duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(volume, t0+0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0+duration);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0+duration+0.02);
    }
    return {
      grab(){ tone(500, {duration:0.05, type:"triangle", volume:0.10}); },
      place(){ tone(360, {duration:0.09, type:"triangle", volume:0.18}); },
      invalid(){ tone(120, {duration:0.14, type:"square", volume:0.12}); },
      lineClear(){
        tone(784.0, {duration:0.10, type:"sine", volume:0.20});
        tone(1046.5, {duration:0.24, type:"sine", volume:0.24, delay:0.07});
      },
      clear(lineCount){
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5 E5 G5 B5 D6
        const n = Math.min(lineCount, notes.length);
        for(let i=0;i<n;i++){
          tone(notes[i], {duration:0.22, type:"sine", volume:0.22, delay:i*0.045});
        }
      },
      gameOver(){ tone(392, {duration:0.5, type:"sawtooth", volume:0.16, glideTo:130}); },
      start(){ tone(660, {duration:0.12, type:"triangle", volume:0.16, glideTo:990}); }
    };
  })();

  // ---------------- CONFIG ----------------
  const GRID = 8;
  const STORAGE_KEY = "dealblocks_best_v1";

  // Piece shapes (voucher-themed set: mix of small, medium, line, and awkward shapes)
  const SHAPES = [
    [[1]],
    [[1,1]],
    [[1],[1]],
    [[1,1,1]],
    [[1],[1],[1]],
    [[1,1],[1,1]],
    [[1,1,1],[0,0,1]],
    [[1,1,1],[1,0,0]],
    [[0,0,1],[1,1,1]],
    [[1,0,0],[1,1,1]],
    [[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,1]],
    [[1,0],[1,0],[1,1]],
    [[0,1],[0,1],[1,1]],
    [[1,1],[1,0],[1,0]],
    [[1,1],[0,1],[0,1]],
    [[1,1,1,1]],
    [[1],[1],[1],[1]],
    [[1,1],[1,1],[1,1]],
    [[1,1,1],[1,1,1]],
    [[1,0,1],[1,1,1]],
    [[1,1],[1,0]],
    [[1,1],[0,1]],
    [[1,0],[1,1]],
    [[0,1],[1,1]],
  ];

  // ---------------- STATE ----------------
  let board = []; // GRID x GRID of 0/1
  let score = 0;
  let best = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  let streak = 0;
  let tray = [null, null, null];
  let gameOver = false;
  let boardCellEls = [];
  let cellSize = 0;
  let boardRect = null;

  // drag state
  let dragging = null; // { trayIndex, shape, offsetR, offsetC, pointerId }

  // ---------------- DOM ----------------
  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const scoreValEl = document.getElementById("scoreVal");
  const bestValEl = document.getElementById("bestVal");
  const streakValEl = document.getElementById("streakVal");
  const comboTagEl = document.getElementById("comboTag");
  const dragGhostEl = document.getElementById("dragGhost");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startOverlay = document.getElementById("startOverlay");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBestEl = document.getElementById("finalBest");
  const boardWrap = document.querySelector(".board-wrap");

  bestValEl.textContent = best;

  // ---------------- INIT BOARD DOM ----------------
  function buildBoardDOM(){
    boardEl.innerHTML = "";
    boardCellEls = [];
    for(let r=0;r<GRID;r++){
      const row = [];
      for(let c=0;c<GRID;c++){
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        boardEl.appendChild(cell);
        row.push(cell);
      }
      boardCellEls.push(row);
    }
  }

  function resetBoardState(){
    board = Array.from({length:GRID}, () => Array(GRID).fill(0));
    score = 0;
    streak = 0;
    gameOver = false;
    updateScoreUI();
    buildBoardDOM();
    renderBoard();
  }

  // ---------------- RENDER ----------------
  function renderBoard(){
    for(let r=0;r<GRID;r++){
      for(let c=0;c<GRID;c++){
        const el = boardCellEls[r][c];
        if(board[r][c]){
          el.classList.add("filled");
          el.style.background = board[r][c] === 2 ? "var(--gold)" : "var(--coral)";
        } else {
          el.classList.remove("filled");
          el.style.background = "";
        }
      }
    }
  }

  function updateScoreUI(){
    if(score > Number(scoreValEl.textContent)){
      scoreValEl.classList.remove("bump");
      void scoreValEl.offsetWidth;
      scoreValEl.classList.add("bump");
    }
    scoreValEl.textContent = score;
    streakValEl.textContent = streak;
    if(score > best){
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }
    bestValEl.textContent = best;
  }

  // ---------------- PIECE GENERATION ----------------
  function randomShape(){
    return SHAPES[Math.floor(Math.random()*SHAPES.length)];
  }

  function fillTray(){
    for(let i=0;i<3;i++){
      if(!tray[i]){
        tray[i] = { shape: randomShape(), id: Math.random().toString(36).slice(2), isNew: true };
      }
    }
    renderTray();
    checkGameOver();
  }

  function renderTray(){
    trayEl.innerHTML = "";
    tray.forEach((piece, idx) => {
      const slot = document.createElement("div");
      slot.className = "piece-slot" + (piece ? "" : " empty") + (piece && piece.isNew ? " pop-in" : "");
      slot.dataset.idx = idx;
      if(piece){
        piece.isNew = false;
        const rows = piece.shape.length;
        const cols = piece.shape[0].length;
        const grid = document.createElement("div");
        grid.className = "piece-grid";
        const size = Math.max(14, Math.min(20, 64/Math.max(rows,cols)));
        grid.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
        grid.style.gridTemplateRows = `repeat(${rows}, ${size}px)`;
        piece.shape.forEach(row => {
          row.forEach(v => {
            const pc = document.createElement("div");
            pc.className = "piece-cell" + (v ? "" : " empty");
            grid.appendChild(pc);
          });
        });
        slot.appendChild(grid);
        slot.addEventListener("pointerdown", (e) => onPieceGrab(e, idx));
      }
      trayEl.appendChild(slot);
    });
  }

  // ---------------- PLACEMENT LOGIC ----------------
  function canPlace(shape, baseR, baseC){
    for(let r=0;r<shape.length;r++){
      for(let c=0;c<shape[0].length;c++){
        if(!shape[r][c]) continue;
        const rr = baseR + r, cc = baseC + c;
        if(rr<0||rr>=GRID||cc<0||cc>=GRID) return false;
        if(board[rr][cc]) return false;
      }
    }
    return true;
  }

  function anyPlacementExists(shape){
    for(let r=0;r<GRID;r++){
      for(let c=0;c<GRID;c++){
        if(canPlace(shape, r, c)) return true;
      }
    }
    return false;
  }

  function checkGameOver(){
    const alive = tray.some(p => p && anyPlacementExists(p.shape));
    if(!alive && tray.some(p => p)){
      triggerGameOver();
    }
  }

  function placePiece(shape, baseR, baseC){
    for(let r=0;r<shape.length;r++){
      for(let c=0;c<shape[0].length;c++){
        if(shape[r][c]) board[baseR+r][baseC+c] = 1;
      }
    }
  }

  function countCells(shape){
    return shape.flat().filter(Boolean).length;
  }

  function findFullLines(){
    const rows = [];
    const cols = [];
    for(let r=0;r<GRID;r++){
      if(board[r].every(v => v)) rows.push(r);
    }
    for(let c=0;c<GRID;c++){
      let full = true;
      for(let r=0;r<GRID;r++){ if(!board[r][c]){ full=false; break; } }
      if(full) cols.push(c);
    }
    return { rows, cols };
  }

  function clearLines(rows, cols, originX, originY){
    const cellsToAnimate = new Set();
    rows.forEach(r => { for(let c=0;c<GRID;c++) cellsToAnimate.add(r+","+c); });
    cols.forEach(c => { for(let r=0;r<GRID;r++) cellsToAnimate.add(r+","+c); });

    cellsToAnimate.forEach(key => {
      const [r,c] = key.split(",").map(Number);
      boardCellEls[r][c].classList.add("clearing");
    });

    const lineCount = rows.length + cols.length;
    let bonus = 0;
    if(lineCount > 0){
      streak++;
      const base = lineCount * GRID * 10;
      const comboMult = lineCount >= 2 ? (1 + (lineCount-1)*0.5) : 1;
      bonus = Math.round(base * comboMult);
      score += bonus;

      if(lineCount >= 2){
        comboTagEl.textContent = lineCount+"x COMBO";
        comboTagEl.classList.add("show");
        setTimeout(()=>comboTagEl.classList.remove("show"), 900);
        boardEl.classList.remove("combo-flash");
        void boardEl.offsetWidth;
        boardEl.classList.add("combo-flash");
        SFX.clear(lineCount);
      } else {
        boardEl.classList.remove("line-flash");
        void boardEl.offsetWidth;
        boardEl.classList.add("line-flash");
        SFX.lineClear();
      }
      showFloatingScore("+"+bonus, originX, originY, lineCount >= 2);
    } else {
      streak = 0;
    }

    setTimeout(() => {
      cellsToAnimate.forEach(key => {
        const [r,c] = key.split(",").map(Number);
        board[r][c] = 0;
        boardCellEls[r][c].classList.remove("clearing");
      });
      renderBoard();
      updateScoreUI();
    }, 320);

    updateScoreUI();
  }

  function showFloatingScore(text, x, y, big){
    const pop = document.createElement("div");
    pop.className = "float-pop";
    pop.textContent = text;
    pop.style.left = x+"px";
    pop.style.top = y+"px";
    if(big){ pop.style.fontSize = "30px"; pop.style.color = "var(--mint)"; }
    boardWrap.appendChild(pop);
    setTimeout(()=>pop.remove(), 820);
  }

  function triggerGameOver(){
    gameOver = true;
    finalScoreEl.textContent = score;
    finalBestEl.textContent = best;
    SFX.gameOver();
    setTimeout(()=>gameOverOverlay.classList.add("show"), 250);
  }

  // ---------------- DRAG & DROP (pointer events, mouse+touch unified) ----------------
  function onPieceGrab(e, trayIdx){
    if(gameOver) return;
    e.preventDefault();
    const piece = tray[trayIdx];
    if(!piece) return;

    SFX.grab();

    const shape = piece.shape;
    const rows = shape.length, cols = shape[0].length;

    dragging = {
      trayIdx, shape, pointerId: e.pointerId,
      rows, cols
    };

    // dim source slot
    const slotEl = trayEl.querySelector(`[data-idx="${trayIdx}"]`);
    if(slotEl) slotEl.classList.add("dragging-source");

    // build ghost
    const cellPx = getCellSize();
    dragGhostEl.style.setProperty("--gc", cols);
    dragGhostEl.style.gridTemplateColumns = `repeat(${cols}, ${cellPx}px)`;
    dragGhostEl.style.gridTemplateRows = `repeat(${rows}, ${cellPx}px)`;
    dragGhostEl.innerHTML = "";
    shape.forEach(row => {
      row.forEach(v => {
        const gc = document.createElement("div");
        gc.className = "g-cell" + (v?"":" empty");
        gc.style.width = cellPx+"px";
        gc.style.height = cellPx+"px";
        dragGhostEl.appendChild(gc);
      });
    });
    dragGhostEl.style.display = "grid";

    boardRect = boardEl.getBoundingClientRect();

    moveGhost(e.clientX, e.clientY);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function getCellSize(){
    const r = boardEl.getBoundingClientRect();
    return (r.width - 8*2 - 4*(GRID-1)) / GRID;
  }

  function onPointerMove(e){
    if(!dragging) return;
    moveGhost(e.clientX, e.clientY);
    updatePreview(e.clientX, e.clientY);
  }

  const LIFT = 70; // px above finger so it's visible on mobile

  function moveGhost(clientX, clientY){
    const cellPx = getCellSize();
    const w = dragging.cols * cellPx + (dragging.cols-1)*3;
    const h = dragging.rows * cellPx + (dragging.rows-1)*3;
    dragGhostEl.style.left = (clientX - w/2) + "px";
    dragGhostEl.style.top = (clientY - h/2 - LIFT) + "px";
  }

  function getTargetCell(clientX, clientY){
    const cellPx = getCellSize();
    const gap = 4;
    const pad = 8;
    const originX = boardRect.left + pad;
    const originY = boardRect.top + pad;

    // anchor point = center of ghost, adjusted for lift
    const anchorX = clientX;
    const anchorY = clientY - LIFT;

    // top-left of the shape's bounding box in board space
    const w = dragging.cols * cellPx + (dragging.cols-1)*gap;
    const h = dragging.rows * cellPx + (dragging.rows-1)*gap;
    const boxLeft = anchorX - w/2;
    const boxTop = anchorY - h/2;

    const c = Math.round((boxLeft - originX) / (cellPx+gap));
    const r = Math.round((boxTop - originY) / (cellPx+gap));
    return { r, c };
  }

  function clearPreview(){
    for(let r=0;r<GRID;r++){
      for(let c=0;c<GRID;c++){
        boardCellEls[r][c].classList.remove("preview-ok","preview-bad");
      }
    }
  }

  let lastPreview = null;
  function updatePreview(clientX, clientY){
    clearPreview();
    const { r, c } = getTargetCell(clientX, clientY);
    const ok = canPlace(dragging.shape, r, c);
    lastPreview = { r, c, ok };

    for(let sr=0; sr<dragging.rows; sr++){
      for(let sc=0; sc<dragging.cols; sc++){
        if(!dragging.shape[sr][sc]) continue;
        const rr = r+sr, cc = c+sc;
        if(rr>=0 && rr<GRID && cc>=0 && cc<GRID){
          boardCellEls[rr][cc].classList.add(ok?"preview-ok":"preview-bad");
        }
      }
    }
  }

  function onPointerUp(e){
    if(!dragging) return;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    clearPreview();
    dragGhostEl.style.display = "none";

    const slotEl = trayEl.querySelector(`[data-idx="${dragging.trayIdx}"]`);
    if(slotEl) slotEl.classList.remove("dragging-source");

    if(lastPreview && lastPreview.ok){
      const { r, c } = lastPreview;
      const shape = dragging.shape;
      const cellsPlaced = countCells(shape);

      placePiece(shape, r, c);
      score += cellsPlaced;
      SFX.place();

      // compute origin for popup (center of placed piece, in page coords)
      const cellPx = getCellSize();
      const midR = r + shape.length/2;
      const midC = c + shape[0].length/2;
      const originX = boardRect.left + 8 + midC*(cellPx+4);
      const originY = boardRect.top + 8 + midR*(cellPx+4);

      renderBoard();
      updateScoreUI();

      for(let sr=0; sr<shape.length; sr++){
        for(let sc=0; sc<shape[0].length; sc++){
          if(!shape[sr][sc]) continue;
          const cellEl = boardCellEls[r+sr][c+sc];
          cellEl.classList.remove("placed-pop");
          void cellEl.offsetWidth;
          cellEl.classList.add("placed-pop");
        }
      }

      tray[dragging.trayIdx] = null;
      renderTray();

      const { rows, cols } = findFullLines();
      clearLines(rows, cols, originX - boardWrap.getBoundingClientRect().left, originY - boardWrap.getBoundingClientRect().top);

      if(tray.every(p => !p)){
        fillTray();
      } else {
        checkGameOver();
      }
    } else if(lastPreview){
      SFX.invalid();
      boardEl.classList.remove("shake");
      void boardEl.offsetWidth;
      boardEl.classList.add("shake");
    }

    dragging = null;
    lastPreview = null;
  }

  // ---------------- CONTROLS ----------------
  document.getElementById("startBtn").addEventListener("click", () => {
    SFX.start();
    startOverlay.classList.remove("show");
    startGame();
  });
  document.getElementById("playAgainBtn").addEventListener("click", () => {
    SFX.start();
    gameOverOverlay.classList.remove("show");
    startGame();
  });
  document.getElementById("restartBtn").addEventListener("click", () => {
    if(confirm("Restart the current game?")){
      SFX.start();
      startGame();
    }
  });

  function startGame(){
    resetBoardState();
    tray = [null,null,null];
    fillTray();
  }

  // prevent page scroll/bounce on mobile while dragging
  document.body.addEventListener("touchmove", (e) => {
    if(dragging) e.preventDefault();
  }, { passive:false });

  window.addEventListener("resize", () => { boardRect = boardEl.getBoundingClientRect(); });

  // initial build (idle state behind start overlay)
  buildBoardDOM();

})();

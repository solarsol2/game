// 게임 코어: 타일 기반 물리/충돌, 2D 카메라, 렌더링, 상태머신

class Game {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks || {}; // { onClear, onAllClear, onDeath, onHudUpdate, onStar }

    this.C = GAME_CONST;
    this.keys = { left: false, right: false, up: false, down: false };

    this.state = "idle"; // idle | playing | cleared | allclear
    this.levelNumber = 1;
    this.attempts = 1;
    this.time = 0;

    this.loadLevel(1);
  }

  loadLevel(levelNumber) {
    this.levelNumber = levelNumber;
    this.level = generateLevel(levelNumber);
    this.attempts = 1;
    this.collectedStars = 0;
    this.resetBall();
    this.state = "playing";
    this.clearTimer = 0;
    this._emitHud();
  }

  resetBall() {
    this.ball = {
      x: this.level.startPx.x,
      y: this.level.startPx.y,
      vx: 0,
      vy: 0,
      squash: 0,
      onGroundFlash: 0,
    };
    this.cameraX = 0;
    this.cameraY = 0;
    for (const m of this.level.markers.values()) {
      if (m.type === "star") m.collected = false;
    }
    this.collectedStars = 0;
  }

  die() {
    if (this.state !== "playing") return;
    this.attempts++;
    this.resetBall();
    this._emitHud();
    if (this.callbacks.onDeath) this.callbacks.onDeath();
  }

  setKey(name, value) {
    this.keys[name] = value;
  }

  // --- 타일 조회 ---
  cellAt(col, row) {
    const lv = this.level;
    if (col < 0 || row < 0 || col >= lv.cols || row >= lv.rows) return this.C.CELL_WALL;
    return lv.grid[row][col];
  }

  isSolid(col, row) {
    const v = this.cellAt(col, row);
    return v === this.C.CELL_WALL || v === this.C.CELL_HAZARD;
  }

  isHazard(col, row) {
    return this.cellAt(col, row) === this.C.CELL_HAZARD;
  }

  update(deltaMs) {
    this.time += deltaMs;

    if (this.state === "cleared") {
      this.clearTimer -= deltaMs;
      if (this.clearTimer <= 0) {
        if (this.levelNumber >= this.C.TOTAL_LEVELS) {
          this.state = "allclear";
          if (this.callbacks.onAllClear) this.callbacks.onAllClear();
        } else {
          this.loadLevel(this.levelNumber + 1);
        }
      }
      return;
    }

    if (this.state !== "playing") return;

    const dt = Math.min(2, deltaMs / 16.6667);
    const C = this.C;
    const T = C.TILE;
    const b = this.ball;

    // --- 수평 입력 ---
    if (this.keys.left && !this.keys.right) {
      b.vx -= C.MOVE_ACCEL * dt;
    } else if (this.keys.right && !this.keys.left) {
      b.vx += C.MOVE_ACCEL * dt;
    } else {
      b.vx *= Math.pow(C.AIR_DRAG, dt);
    }
    // MAX_VX는 입력 가속만 제한하고, 부스터로 초과된 속도는 서서히 감쇠한다.
    if (b.vx > C.MAX_VX) b.vx = Math.max(C.MAX_VX, b.vx - C.OVER_SPEED_DECAY * dt);
    else if (b.vx < -C.MAX_VX) b.vx = Math.min(-C.MAX_VX, b.vx + C.OVER_SPEED_DECAY * dt);

    // --- 중력 ---
    const gravity = C.GRAVITY * (this.keys.down ? C.FAST_FALL_MULT : 1);
    b.vy += gravity * dt;

    if (b.squash > 0) b.squash -= dt * 0.15;
    if (b.onGroundFlash > 0) b.onGroundFlash -= dt;

    // --- 서브스텝으로 나눠 충돌 처리(터널링 방지) ---
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      if (this.state !== "playing") break;
      this._moveAxis(b, "x", (b.vx * dt) / steps, dt);
      if (this.state !== "playing") break;
      this._moveAxis(b, "y", (b.vy * dt) / steps, dt);
      if (this.state !== "playing") break;
      this._checkMarkers(b);
      if (this.state !== "playing") break;
    }

    if (this.state !== "playing") return;

    // --- 카메라(2D, 레벨 경계 클램프) ---
    const targetCamX = b.x - C.CANVAS_W * 0.4;
    const targetCamY = b.y - C.CANVAS_H * 0.5;
    this.cameraX = Math.max(0, Math.min(this.level.pixelW - C.CANVAS_W, targetCamX));
    this.cameraY = Math.max(0, Math.min(this.level.pixelH - C.CANVAS_H, targetCamY));
  }

  _tileRange(minPx, maxPx) {
    const T = this.C.TILE;
    return [Math.floor(minPx / T), Math.floor(maxPx / T)];
  }

  _moveAxis(b, axis, delta, dt) {
    const C = this.C;
    const r = C.BALL_RADIUS;

    if (axis === "x") {
      b.x += delta;
      const [rowMin, rowMax] = this._tileRange(b.y - r, b.y + r);
      const [colMin, colMax] = this._tileRange(b.x - r, b.x + r);
      for (let row = rowMin; row <= rowMax; row++) {
        for (let col = colMin; col <= colMax; col++) {
          if (!this.isSolid(col, row)) continue;
          const tileL = col * C.TILE, tileR = tileL + C.TILE;
          if (b.x + r > tileL && b.x - r < tileR) {
            if (this.isHazard(col, row)) { this._onDeath(); return; }
            if (delta > 0) b.x = tileL - r; else if (delta < 0) b.x = tileR + r;
            b.vx = -b.vx * 0.35;
          }
        }
      }
    } else {
      b.y += delta;
      const [colMin, colMax] = this._tileRange(b.x - r, b.x + r);
      const [rowMin, rowMax] = this._tileRange(b.y - r, b.y + r);
      for (let row = rowMin; row <= rowMax; row++) {
        for (let col = colMin; col <= colMax; col++) {
          if (!this.isSolid(col, row)) continue;
          const tileT = row * C.TILE, tileB = tileT + C.TILE;
          if (b.y + r > tileT && b.y - r < tileB) {
            if (this.isHazard(col, row)) { this._onDeath(); return; }
            if (delta > 0) {
              // 착지: 항상 고정된 힘으로 튀어오름
              b.y = tileT - r;
              const power = this.keys.up ? C.POWER_BOUNCE_MULT : 1;
              b.vy = C.BOUNCE_VY * power;
              b.squash = 1;
              b.onGroundFlash = 4;
              if (this.callbacks.onBounce) this.callbacks.onBounce();
            } else if (delta < 0) {
              b.y = tileB + r;
              b.vy = Math.max(0, -b.vy * 0.3);
            }
          }
        }
      }
    }
  }

  _checkMarkers(b) {
    const C = this.C;
    const col = Math.floor(b.x / C.TILE);
    const row = Math.floor(b.y / C.TILE);
    const m = this.level.markers.get(col + "," + row);
    if (!m) return;

    if (m.type === "arrow") {
      if (m.dir === "U") b.vy = C.ARROW_UP_VY;
      else if (m.dir === "D") b.vy = C.ARROW_DOWN_VY;
      else if (m.dir === "R") b.vx = C.ARROW_SIDE_VX;
      else if (m.dir === "L") b.vx = -C.ARROW_SIDE_VX;
    } else if (m.type === "star") {
      if (!m.collected) {
        m.collected = true;
        this.collectedStars++;
        if (this.callbacks.onStar) this.callbacks.onStar(this.collectedStars, this.level.totalStars);
        this._emitHud();
      }
    } else if (m.type === "goal") {
      this.state = "cleared";
      this.clearTimer = 1100;
      if (this.callbacks.onClear) this.callbacks.onClear(this.levelNumber);
    }
  }

  _onDeath() {
    this.die();
  }

  _emitHud() {
    if (this.callbacks.onHudUpdate) {
      this.callbacks.onHudUpdate({
        level: this.levelNumber,
        attempts: this.attempts,
        total: this.C.TOTAL_LEVELS,
        stars: this.collectedStars,
        totalStars: this.level.totalStars,
      });
    }
  }

  render() {
    const C = this.C;
    const T = C.TILE;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const sky = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    sky.addColorStop(0, "#1b2450");
    sky.addColorStop(1, "#3a4a8a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.save();
    ctx.translate(-Math.floor(this.cameraX), -Math.floor(this.cameraY));

    const colMin = Math.max(0, Math.floor(this.cameraX / T) - 1);
    const colMax = Math.min(this.level.cols - 1, Math.floor((this.cameraX + C.CANVAS_W) / T) + 1);
    const rowMin = Math.max(0, Math.floor(this.cameraY / T) - 1);
    const rowMax = Math.min(this.level.rows - 1, Math.floor((this.cameraY + C.CANVAS_H) / T) + 1);

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const v = this.level.grid[row][col];
        if (v === C.CELL_EMPTY) continue;
        const x = col * T, y = row * T;
        if (v === C.CELL_WALL) {
          ctx.fillStyle = "#4a5aa8";
          ctx.fillRect(x, y, T, T);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x, y, T, 4);
        } else if (v === C.CELL_HAZARD) {
          this._drawHazardTile(x, y, T);
        }
      }
    }

    // 마커(화살표/별/골)
    for (const [k, m] of this.level.markers) {
      const [col, row] = k.split(",").map(Number);
      if (col < colMin - 1 || col > colMax + 1 || row < rowMin - 1 || row > rowMax + 1) continue;
      const cx = col * T + T / 2, cy = row * T + T / 2;
      if (m.type === "arrow") this._drawArrow(cx, cy, m.dir);
      else if (m.type === "star" && !m.collected) this._drawStar(cx, cy);
      else if (m.type === "goal") this._drawGoal(cx, cy);
    }

    // 공
    const b = this.ball;
    const squashY = 1 - b.squash * 0.3;
    const squashX = 1 + b.squash * 0.3;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(squashX, squashY);
    const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, C.BALL_RADIUS);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#4fd1c5");
    grad.addColorStop(1, "#1a7d74");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, C.BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  _drawHazardTile(x, y, T) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#ff4d6d";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    const cx = x + T / 2, cy = y + T / 2;
    ctx.moveTo(cx - 3, cy - 10);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.lineTo(cx - 1, cy - 2);
    ctx.lineTo(cx + 3, cy + 10);
    ctx.lineTo(cx - 5, cy + 1);
    ctx.lineTo(cx, cy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawArrow(cx, cy, dir) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    const rot = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }[dir];
    ctx.rotate(rot);
    ctx.fillStyle = "#f6ad55";
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.lineTo(10, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawStar(cx, cy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      ctx.lineTo(Math.cos(a1) * 10, Math.sin(a1) * 10);
      ctx.lineTo(Math.cos(a2) * 4, Math.sin(a2) * 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawGoal(cx, cy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#555";
    ctx.fillRect(cx - 2, cy - 10, 4, 40);
    ctx.fillStyle = "#4fd1c5";
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 10);
    ctx.lineTo(cx + 26, cy - 3);
    ctx.lineTo(cx + 2, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

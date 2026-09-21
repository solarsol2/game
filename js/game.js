// 게임 코어: 물리, 충돌, 렌더링, 상태머신

class Game {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks || {}; // { onClear(level), onAllClear(), onDeath(), onHudUpdate(state) }

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
    this.resetBall();
    this.state = "playing";
    this.clearTimer = 0;
    this._emitHud();
  }

  resetBall() {
    this.ball = {
      x: this.level.start.x,
      y: this.level.start.y,
      vx: 0,
      vy: 0,
      squash: 0, // 착지 스쿼시 애니메이션용
    };
    this.cameraX = 0;
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

  // deltaMs: 실제 경과 시간(밀리초). 물리는 60fps 기준 프레임 단위(frameDt)로,
  // 타이머/애니메이션은 실제 ms(this.time)로 계산해 프레임레이트에 관계없이 일정하게 만든다.
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

    const dt = Math.min(2, deltaMs / 16.6667); // 프레임 정규화(1.0 = 60fps 한 프레임)
    const C = this.C;
    const b = this.ball;

    // --- 수평 이동 ---
    if (this.keys.left && !this.keys.right) {
      b.vx -= C.MOVE_ACCEL * dt;
    } else if (this.keys.right && !this.keys.left) {
      b.vx += C.MOVE_ACCEL * dt;
    } else {
      b.vx *= Math.pow(C.AIR_DRAG, dt);
    }
    b.vx = Math.max(-C.MAX_VX, Math.min(C.MAX_VX, b.vx));

    // --- 수직 물리 ---
    const gravity = C.GRAVITY * (this.keys.down ? C.FAST_FALL_MULT : 1);
    b.vy += gravity * dt;

    const prevBottom = b.y + C.BALL_RADIUS;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.squash > 0) b.squash -= dt * 0.15;

    // --- 충돌 처리 ---
    if (b.vy >= 0) {
      const hit = this._findLanding(b, prevBottom);
      if (hit) {
        b.y = hit.surfaceY - C.BALL_RADIUS;
        const power = this.keys.up ? C.POWER_BOUNCE_MULT : 1;
        b.vy = C.BOUNCE_VY * power;
        b.squash = 1;
        if (hit.platformVx) {
          b.vx += hit.platformVx * 0.5;
          b.vx = Math.max(-C.MAX_VX * 1.4, Math.min(C.MAX_VX * 1.4, b.vx));
        }
      }
    }

    // --- 스파이크 충돌 ---
    for (const sp of this.level.spikes) {
      const spTop = C.GROUND_Y - 20;
      const closestX = Math.max(sp.x, Math.min(b.x, sp.x + sp.w));
      const closestY = Math.max(spTop, Math.min(b.y, C.GROUND_Y));
      const dx = b.x - closestX;
      const dy = b.y - closestY;
      if (dx * dx + dy * dy < C.BALL_RADIUS * C.BALL_RADIUS * 0.7) {
        this.die();
        return;
      }
    }

    // --- 구덩이 낙사 ---
    if (b.y - C.BALL_RADIUS > C.GROUND_Y + 140) {
      this.die();
      return;
    }

    // --- 좌측 이탈 방지 ---
    if (b.x < C.BALL_RADIUS) {
      b.x = C.BALL_RADIUS;
      b.vx = Math.max(0, b.vx);
    }

    // --- 골 체크 ---
    const g = this.level.goal;
    if (Math.abs(b.x - g.x) < 26 && b.y > C.GROUND_Y - 120) {
      this.state = "cleared";
      this.clearTimer = 1100;
      if (this.callbacks.onClear) this.callbacks.onClear(this.levelNumber);
    }

    // --- 카메라 ---
    const targetCam = b.x - C.CANVAS_W * 0.35;
    this.cameraX = Math.max(0, Math.min(this.level.width - C.CANVAS_W, targetCam));
  }

  _platformRect(p) {
    if (!p.moving) return { x1: p.x1, x2: p.x2, y: p.y, vx: 0 };
    const offset = Math.sin(this.time * p.speed + p.phase) * p.amplitude;
    const prevOffset = Math.sin((this.time - 16) * p.speed + p.phase) * p.amplitude;
    const vx = (offset - prevOffset) / 16;
    return { x1: p.baseX1 + offset, x2: p.baseX2 + offset, y: p.y, vx };
  }

  _findLanding(b, prevBottom) {
    const C = this.C;
    const curBottom = b.y + C.BALL_RADIUS;
    const tol = C.BALL_RADIUS * 0.5;

    for (const seg of this.level.groundSegments) {
      if (b.x >= seg.x1 - tol && b.x <= seg.x2 + tol) {
        const y = C.GROUND_Y;
        if (prevBottom <= y + 0.5 && curBottom >= y) {
          return { surfaceY: y, platformVx: 0 };
        }
      }
    }

    for (const p of this.level.platforms) {
      const rect = this._platformRect(p);
      if (b.x >= rect.x1 - tol && b.x <= rect.x2 + tol) {
        if (prevBottom <= rect.y + 0.5 && curBottom >= rect.y) {
          return { surfaceY: rect.y, platformVx: rect.vx };
        }
      }
    }
    return null;
  }

  _emitHud() {
    if (this.callbacks.onHudUpdate) {
      this.callbacks.onHudUpdate({
        level: this.levelNumber,
        attempts: this.attempts,
        total: this.C.TOTAL_LEVELS,
      });
    }
  }

  render() {
    const C = this.C;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    sky.addColorStop(0, "#87ceeb");
    sky.addColorStop(1, "#c9f0ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // 바닥
    ctx.fillStyle = "#5b8c3a";
    for (const seg of this.level.groundSegments) {
      ctx.fillRect(seg.x1, C.GROUND_Y, seg.x2 - seg.x1, C.CANVAS_H - C.GROUND_Y);
      ctx.fillStyle = "#3f6b28";
      ctx.fillRect(seg.x1, C.GROUND_Y, seg.x2 - seg.x1, 6);
      ctx.fillStyle = "#5b8c3a";
    }

    // 발판
    for (const p of this.level.platforms) {
      const rect = this._platformRect(p);
      ctx.fillStyle = p.moving ? "#c77d3f" : "#8a5a2b";
      ctx.fillRect(rect.x1, rect.y, rect.x2 - rect.x1, 16);
    }

    // 스파이크
    ctx.fillStyle = "#e63946";
    for (const sp of this.level.spikes) {
      ctx.beginPath();
      ctx.moveTo(sp.x, C.GROUND_Y);
      ctx.lineTo(sp.x + sp.w / 2, C.GROUND_Y - 20);
      ctx.lineTo(sp.x + sp.w, C.GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    // 골(깃발)
    const g = this.level.goal;
    ctx.fillStyle = "#555";
    ctx.fillRect(g.x - 3, C.GROUND_Y - 110, 6, 110);
    ctx.fillStyle = "#f6ad55";
    ctx.beginPath();
    ctx.moveTo(g.x + 3, C.GROUND_Y - 110);
    ctx.lineTo(g.x + 40, C.GROUND_Y - 96);
    ctx.lineTo(g.x + 3, C.GROUND_Y - 82);
    ctx.closePath();
    ctx.fill();

    // 공
    const b = this.ball;
    const squashY = 1 - b.squash * 0.3;
    const squashX = 1 + b.squash * 0.3;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(squashX, squashY);
    const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, C.BALL_RADIUS);
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
}

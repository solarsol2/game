(function () {
  const C = GAME_CONST;
  const canvas = document.getElementById("gameCanvas");

  const hudLevel = document.getElementById("hud-level");
  const hudProgressFill = document.getElementById("hud-progress-fill");
  const hudAttempts = document.getElementById("hud-attempts");

  const startScreen = document.getElementById("startScreen");
  const clearScreen = document.getElementById("clearScreen");
  const clearTitle = document.getElementById("clearTitle");
  const allClearScreen = document.getElementById("allClearScreen");

  const btnContinue = document.getElementById("btnContinue");
  const btnRestart = document.getElementById("btnRestart");
  const btnPlayAgain = document.getElementById("btnPlayAgain");

  function loadProgress() {
    try {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      if (!raw) return { currentLevel: 1 };
      const parsed = JSON.parse(raw);
      if (!parsed.currentLevel || parsed.currentLevel < 1) return { currentLevel: 1 };
      return parsed;
    } catch (e) {
      return { currentLevel: 1 };
    }
  }

  function saveProgress(levelNumber) {
    try {
      localStorage.setItem(C.STORAGE_KEY, JSON.stringify({ currentLevel: levelNumber }));
    } catch (e) {
      /* localStorage 사용 불가 환경은 무시 */
    }
  }

  const game = new Game(canvas, {
    onHudUpdate: (s) => {
      hudLevel.textContent = `STAGE ${s.level} / ${s.total}`;
      hudProgressFill.style.width = `${(s.level / s.total) * 100}%`;
      hudAttempts.textContent = `시도 ${s.attempts}`;
    },
    onClear: (levelNumber) => {
      saveProgress(Math.min(levelNumber + 1, C.TOTAL_LEVELS));
      clearTitle.textContent = levelNumber >= C.TOTAL_LEVELS ? "FINAL STAGE CLEAR!" : "STAGE CLEAR!";
      clearScreen.classList.remove("hidden");
      setTimeout(() => clearScreen.classList.add("hidden"), 1000);
    },
    onAllClear: () => {
      allClearScreen.classList.remove("hidden");
    },
    onDeath: () => {},
    onBounce: (isPower) => {
      audioManager.playBounce(isPower);
    },
  });

  const saved = loadProgress();
  if (saved.currentLevel > 1) {
    btnContinue.textContent = `이어하기 (STAGE ${saved.currentLevel})`;
    btnContinue.classList.remove("hidden");
  } else {
    btnContinue.classList.add("hidden");
  }

  function startGame(levelNumber) {
    startScreen.classList.add("hidden");
    allClearScreen.classList.add("hidden");
    audioManager.startMusic();
    game.loadLevel(levelNumber);
    saveProgress(levelNumber);
  }

  btnContinue.addEventListener("click", () => startGame(saved.currentLevel));
  btnRestart.addEventListener("click", () => startGame(1));
  btnPlayAgain.addEventListener("click", () => startGame(1));

  // --- 키보드 입력 ---
  const KEY_MAP = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
  };

  window.addEventListener("keydown", (e) => {
    const k = KEY_MAP[e.key];
    if (k) {
      game.setKey(k, true);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEY_MAP[e.key];
    if (k) {
      game.setKey(k, false);
      e.preventDefault();
    }
  });

  // 탭 전환 시 눌림 상태가 고정되는 것을 방지
  window.addEventListener("blur", () => {
    game.setKey("left", false);
    game.setKey("right", false);
    game.setKey("up", false);
    game.setKey("down", false);
  });

  // --- 모바일 터치 입력 ---
  function bindTouch(id, key) {
    const el = document.getElementById(id);
    const set = (v) => (e) => {
      game.setKey(key, v);
      e.preventDefault();
    };
    el.addEventListener("touchstart", set(true), { passive: false });
    el.addEventListener("touchend", set(false), { passive: false });
    el.addEventListener("touchcancel", set(false), { passive: false });
    el.addEventListener("mousedown", set(true));
    el.addEventListener("mouseup", set(false));
    el.addEventListener("mouseleave", set(false));
  }
  bindTouch("tLeft", "left");
  bindTouch("tRight", "right");
  bindTouch("tUp", "up");
  bindTouch("tDown", "down");

  // --- 메인 루프 ---
  let lastTs = null;
  function loop(ts) {
    if (lastTs === null) lastTs = ts;
    const deltaMs = Math.min(50, ts - lastTs); // 탭 비활성 후 급점프 방지
    lastTs = ts;

    game.update(deltaMs);
    game.render();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

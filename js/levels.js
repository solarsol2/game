// 레벨 절차적 생성기 (타일 그리드 기반 미로).
// 레벨 번호를 시드로 사용해 항상 같은 스테이지를 생성한다.
//
// 난이도 설계(레벨 1~100, difficulty = (level-1)/99):
//  - Lv 1~9   튜토리얼: 넓은 통로, 장애물/화살표 없음, 턴 적음
//  - Lv 10~24 기본 미로: 전기펜스(즉사 벽) 등장, 통로 폭 축소 시작
//  - Lv 25~49 부스터 구간: 화살표 타일 등장(강제 구간 포함), 장애물 바닥 등장
//  - Lv 50~74 등반 구간: 발판을 밟고 올라가는 수직 샤프트 등장, 경로가 더 꼬임
//  - Lv 75~100 마스터: 좁은 1타일 통로 + 연속 화살표 체인 + 최고 밀도 장애물
//
// 목표 지점은 단순히 "멀리"가 아니라 굴곡진 경로 끝에 위치하도록
// 방향(R/L/U/D)을 무작위로 바꿔가며 통로를 깎아 나간다.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLevel(levelNumber) {
  const C = GAME_CONST;
  const rand = mulberry32(levelNumber * 7919 + 13);
  const difficulty = Math.min(1, (levelNumber - 1) / (C.TOTAL_LEVELS - 1));

  const unlockHazard = levelNumber >= 10;
  const unlockArrow = levelNumber >= 25;
  const unlockClimbHard = levelNumber >= 50;
  const unlockBacktrack = levelNumber >= 60;

  const cols = 34 + Math.floor(difficulty * 26); // 34~60
  const rows = 20 + Math.floor(difficulty * 14); // 20~34

  const grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(C.CELL_WALL));

  const markers = new Map(); // "col,row" -> {type, dir?}
  const stars = [];

  const inBounds = (c, r) => c >= 1 && c < cols - 1 && r >= 1 && r < rows - 1;
  const setCell = (c, r, v) => { if (inBounds(c, r)) grid[r][c] = v; };
  const openCell = (c, r) => setCell(c, r, C.CELL_EMPTY);
  // 경계용 벽/함정 배치 전용: 다른 구간이 이미 뚫어 놓은(지나갈 수 있는) 칸은
  // 절대 다시 막지 않는다 — 통로가 끊기는 것을 방지하는 핵심 안전장치.
  const setBoundary = (c, r, v) => {
    if (!inBounds(c, r)) return;
    if (grid[r][c] === C.CELL_EMPTY) return;
    grid[r][c] = v;
  };
  const key = (c, r) => c + "," + r;

  const hazardProb = unlockHazard ? Math.min(0.6, 0.12 + difficulty * 0.55) : 0;
  const gapChance = unlockArrow ? Math.min(0.55, 0.15 + difficulty * 0.5) : 0;

  // --- 시작 방 ---
  const startCol = 3;
  const startRow = Math.floor(rows / 2);
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) openCell(startCol + dc, startRow + dr);
  for (let dc = -1; dc <= 1; dc++) setCell(startCol + dc, startRow + 2, C.CELL_WALL); // 바닥

  function carveHorizontal(col0, row0, dir, length, width, allowGap) {
    const rowTop = row0 - Math.floor((width - 1) / 2);
    const rowBottom = rowTop + width - 1;
    const floorRow = rowBottom + 1;
    const ceilRow = rowTop - 1;
    const sign = dir === "R" ? 1 : -1;

    let gapStart = -1, gapLen = 0, needsArrow = false;
    if (allowGap && length >= 7 && rand() < gapChance) {
      gapLen = Math.min(length - 4, 2 + Math.floor(rand() * 2) + Math.floor(difficulty * 3));
      gapLen = Math.max(2, gapLen);
      gapStart = 2 + Math.floor(rand() * Math.max(1, length - gapLen - 3));
      needsArrow = gapLen >= 3;
    }

    const hazardCeil = unlockHazard && rand() < hazardProb;
    const hazardFloorTiles = new Set();
    if (gapStart >= 0) for (let s = gapStart; s < gapStart + gapLen; s++) hazardFloorTiles.add(s);

    for (let s = 0; s < length; s++) {
      const c = col0 + s * sign;
      for (let r = rowTop; r <= rowBottom; r++) openCell(c, r);
      setBoundary(c, ceilRow, hazardCeil ? C.CELL_HAZARD : C.CELL_WALL);
      setBoundary(c, floorRow, hazardFloorTiles.has(s) ? C.CELL_HAZARD : C.CELL_WALL);
      if (needsArrow && s === gapStart - 1) {
        markers.set(key(c, floorRow - 1), { type: "arrow", dir: "U" });
      }
    }
    return { col: col0 + (length - 1) * sign + sign, row: row0 };
  }

  function carveFallShaft(col0, row0, height, width) {
    const colLeft = col0 - Math.floor((width - 1) / 2);
    const colRight = colLeft + width - 1;
    const hazardFlank = unlockHazard && rand() < hazardProb;
    for (let r = row0; r <= row0 + height; r++) {
      for (let c = colLeft; c <= colRight; c++) openCell(c, r);
      // 진입 행(row0)과 진출 행은 이웃 구간과 이어지는 지점이므로 측면 벽으로 막지 않는다.
      if (r === row0 || r === row0 + height) continue;
      setBoundary(colLeft - 1, r, hazardFlank ? C.CELL_HAZARD : C.CELL_WALL);
      setBoundary(colRight + 1, r, hazardFlank ? C.CELL_HAZARD : C.CELL_WALL);
    }
    return { col: col0, row: row0 + height };
  }

  function carveClimbShaft(col0, row0, height, width) {
    const colLeft = col0 - Math.floor((width - 1) / 2);
    const colRight = colLeft + width - 1;
    const topRow = row0 - height;
    const hazardFlank = unlockHazard && rand() < hazardProb * 0.8;

    for (let r = topRow; r <= row0; r++) {
      for (let c = colLeft; c <= colRight; c++) openCell(c, r);
      // 진입 행(row0)과 진출 행(topRow)은 이웃 구간과 이어지는 지점이므로 막지 않는다.
      if (r === row0 || r === topRow) continue;
      setBoundary(colLeft - 1, r, hazardFlank ? C.CELL_HAZARD : C.CELL_WALL);
      setBoundary(colRight + 1, r, hazardFlank ? C.CELL_HAZARD : C.CELL_WALL);
    }

    let r = row0;
    while (r > topRow + 1) {
      const stepGap = unlockClimbHard
        ? 2 + Math.floor(rand() * 2) + (difficulty > 0.75 ? 1 : 0)
        : 2;
      r -= stepGap;
      if (r <= topRow + 1) break;
      const platCol = colLeft + Math.floor(rand() * width);
      setCell(platCol, r, C.CELL_WALL);
      if (stepGap >= 3) markers.set(key(platCol, r - 1), { type: "arrow", dir: "U" });
    }
    return { col: col0, row: topRow };
  }

  function carveStarBranch(col0, row0, dir) {
    const sign = dir === "R" ? 1 : dir === "L" ? -1 : 0;
    const vsign = dir === "D" ? 1 : dir === "U" ? -1 : 0;
    const len = 2 + Math.floor(rand() * 2);
    let c = col0, r = row0;
    for (let i = 0; i < len; i++) {
      c += sign; r += vsign;
      openCell(c, r); openCell(c, r - 1);
    }
    setBoundary(c - sign, r - vsign + 1, C.CELL_WALL);
    setBoundary(c, r + 1, C.CELL_WALL);
    const starMarker = { type: "star" };
    markers.set(key(c, r), starMarker);
    stars.push(starMarker);
  }

  function pickNextHeading(current) {
    const perp = current === "R" || current === "L" ? ["U", "D"] : ["R", "L"];
    const opts = [
      { h: current === "U" ? "R" : current, w: 3 }, // 등반 직후에는 위쪽 연속 방지
      { h: perp[0], w: 2 + difficulty * 2 },
      { h: perp[1], w: 2 + difficulty * 2 },
    ];
    if (unlockBacktrack) {
      const back = { R: "L", L: "R", U: "D", D: "U" }[current];
      opts.push({ h: back, w: 0.8 + difficulty * 1.4 });
    }
    const total = opts.reduce((s, o) => s + o.w, 0);
    let roll = rand() * total;
    for (const o of opts) {
      if (roll < o.w) return o.h;
      roll -= o.w;
    }
    return current;
  }

  // --- 메인 경로 생성 ---
  let cursorCol = startCol;
  let cursorRow = startRow;
  let heading = "R";
  const segCount = Math.round(6 + difficulty * 15);

  for (let i = 0; i < segCount; i++) {
    heading = i === 0 ? "R" : pickNextHeading(heading);
    const marginC = 3, marginR = 3;

    if (heading === "R" || heading === "L") {
      const width = difficulty < 0.3 ? 3 : difficulty < 0.65 ? (rand() < 0.5 ? 2 : 3) : (rand() < 0.55 ? 1 : 2);
      let length = 4 + Math.floor(rand() * 5) + Math.floor(difficulty * 3);
      const room = heading === "R" ? cols - marginC - cursorCol : cursorCol - marginC;
      length = Math.min(length, room);
      if (length < 3) continue; // 남은 공간이 부족하면 이 세그먼트는 건너뛴다(커서는 그대로 유지)
      const res = carveHorizontal(cursorCol, cursorRow, heading, length, width, unlockArrow);
      cursorCol = res.col; cursorRow = res.row;
    } else if (heading === "D") {
      const width = difficulty < 0.4 ? 3 : rand() < 0.5 ? 2 : 1;
      let height = 3 + Math.floor(rand() * 4);
      const room = rows - marginR - cursorRow;
      height = Math.min(height, room);
      if (height < 2) continue;
      const res = carveFallShaft(cursorCol, cursorRow, height, width);
      cursorCol = res.col; cursorRow = res.row;
    } else { // U: 등반 샤프트
      const width = difficulty < 0.5 ? 2 : rand() < 0.4 ? 1 : 2;
      let height = 4 + Math.floor(rand() * 4) + Math.floor(difficulty * 4);
      const room = cursorRow - marginR;
      height = Math.min(height, room);
      if (height < 3) continue;
      const res = carveClimbShaft(cursorCol, cursorRow, height, width);
      cursorCol = res.col; cursorRow = res.row;
    }

    if (i > 0 && i < segCount - 1 && rand() < 0.28 + difficulty * 0.15) {
      const branchDir = ["R", "L", "U", "D"][Math.floor(rand() * 4)];
      carveStarBranch(cursorCol, cursorRow, branchDir);
    }
  }

  // --- 목표 방(항상 안전한 바닥이 보장되도록 마지막 복도를 재사용해 마무리) ---
  {
    let finalDir = heading === "U" || heading === "D" ? "R" : heading;
    let sign = finalDir === "R" ? 1 : -1;
    let room = finalDir === "R" ? cols - 4 - cursorCol : cursorCol - 4;
    if (room < 3) { // 반대 방향에 공간이 더 있으면 그쪽으로 목표 방을 배치
      finalDir = finalDir === "R" ? "L" : "R";
      sign = finalDir === "R" ? 1 : -1;
      room = finalDir === "R" ? cols - 4 - cursorCol : cursorCol - 4;
    }
    const len = Math.min(5, room);
    if (len >= 3) {
      const res = carveHorizontal(cursorCol, cursorRow, finalDir, len, 2, false);
      const goalCol = cursorCol + Math.floor((len - 1) / 2) * sign;
      markers.set(key(goalCol, cursorRow), { type: "goal" });
      cursorCol = res.col; cursorRow = res.row;
    } else {
      // 양쪽 모두 공간이 부족하면 현재 커서(이미 뚫려 있는 칸)에 바로 목표를 둔다
      markers.set(key(cursorCol, cursorRow), { type: "goal" });
    }
  }

  const startPx = { x: startCol * C.TILE + C.TILE / 2, y: (startRow + 2) * C.TILE - C.BALL_RADIUS };

  return {
    id: levelNumber,
    cols, rows,
    grid,
    markers,
    stars,
    totalStars: stars.length,
    startPx,
    pixelW: cols * C.TILE,
    pixelH: rows * C.TILE,
  };
}

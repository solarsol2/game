// 레벨 절차적 생성기
// 설계 원칙: 스테이지마다 장애물 10개 이상 보장
//   - 평지 구간에 가시 항상(필수) 배치
//   - 구덩이(낭떠러지) / 계단 발판 / 이동 가시로 다양성 확보
//   - 평지 최대 180px 제한(긴 쉬는 구간 제거)

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
  const C    = GAME_CONST;
  const rand = mulberry32(levelNumber * 7919 + 13);
  const difficulty = Math.min(1, (levelNumber - 1) / (C.TOTAL_LEVELS - 1)); // 0~1

  const groundSegments = [];
  const platforms      = [];
  const spikes         = [];
  const movingSpikes   = [];

  const START_X       = 120;
  const SAFE_START    = 240; // 안전한 출발 구간

  let cursor = START_X;
  groundSegments.push({ x1: 0, x2: START_X + SAFE_START });
  cursor += SAFE_START;

  // 낭떠러지 길이 범위 (단계가 오를수록 더 넓어짐)
  const minGap = 60  + difficulty * 60;   // 60~120px
  const maxGap = 130 + difficulty * 140;  // 130~270px

  // 각 구간 유형 확률
  const detourChance = Math.min(0.38, 0.08 + difficulty * 0.38); // 구덩이+발판
  const stepChance   = Math.min(0.26, 0.06 + difficulty * 0.26); // 계단 발판
  const gapChance    = 0.20 + difficulty * 0.14;                  // 단순 낙사 구덩이
  // 나머지 → 짧은 평지 + 필수 가시

  const movingSpikeChance = levelNumber <= 3 ? 0 : Math.min(0.65, 0.12 + difficulty * 0.62);
  const segCount = 10 + Math.floor(levelNumber * 0.6); // 10~16 구간

  for (let i = 0; i < segCount; i++) {
    const roll = rand();

    // ── 구덩이 + 중간 공중 발판 ─────────────────────────────────
    if (roll < detourChance) {
      const gapLen  = minGap + rand() * (maxGap - minGap);
      const gapStart = cursor;
      cursor += gapLen;

      const platW  = Math.max(60, 140 - difficulty * 65);
      const platY  = C.GROUND_Y - (60 + rand() * 75);
      const platX1 = gapStart + gapLen / 2 - platW / 2;
      platforms.push({ x1: platX1, x2: platX1 + platW, y: platY });

      // 착지 구간 (짧게)
      const land = 80 + rand() * 80;
      groundSegments.push({ x1: cursor, x2: cursor + land });
      cursor += land;

    // ── 계단식 연속 발판 구간 ────────────────────────────────────
    } else if (roll < detourChance + stepChance) {
      const numP    = 2 + Math.floor(rand() * 2); // 2~3개
      const platW   = 58 + rand() * 28;
      const spacing = 82 + rand() * 44;
      const gap     = spacing * (numP + 1);
      const gapStart = cursor;
      cursor += gap;

      for (let p = 0; p < numP; p++) {
        const px = gapStart + spacing * (p + 1) - platW / 2;
        const py = C.GROUND_Y - (38 + rand() * 42);
        platforms.push({ x1: px, x2: px + platW, y: py });
      }

      const land = 80 + rand() * 70;
      groundSegments.push({ x1: cursor, x2: cursor + land });
      cursor += land;

    // ── 단순 낙사 구덩이 ────────────────────────────────────────
    } else if (roll < detourChance + stepChance + gapChance) {
      const gapLen = minGap + rand() * (maxGap + 40);
      cursor += gapLen;

      const land = 80 + rand() * 90;
      groundSegments.push({ x1: cursor, x2: cursor + land });
      cursor += land;

    // ── 짧은 평지 — 가시 필수 ──────────────────────────────────
    } else {
      const len = 90 + rand() * 90; // 90~180px (길면 쉬어가므로 제한)
      const seg = { x1: cursor, x2: cursor + len };
      groundSegments.push(seg);

      // 가시: 항상 최소 1개 ~ 최대 (1+difficulty*3)개
      const spikeCount = 1 + Math.floor(rand() * (1 + Math.floor(difficulty * 3)));
      for (let s = 0; s < spikeCount; s++) {
        const margin = 26;
        const avail  = Math.max(5, len - margin * 2 - spikeCount * 24);
        const sx = seg.x1 + margin + rand() * avail;
        spikes.push({ x: sx, w: 22 });
      }

      // 이동 가시 (level 4+)
      if (levelNumber > 3 && rand() < movingSpikeChance) {
        const margin = 46;
        const bx     = seg.x1 + margin + rand() * Math.max(5, len - margin * 2);
        movingSpikes.push({
          baseX: bx, x: bx, w: 22,
          range: 30 + rand() * 52,
          speed: 1.0 + rand() * 2.2,
          phase: rand() * Math.PI * 2,
        });
      }

      cursor += len;
    }
  }

  // ── 장애물 10개 보장: 부족하면 가시 구간+구덩이 쌍을 추가 ──
  const obstacleCount =
    spikes.length +
    movingSpikes.length +
    platforms.length +
    (groundSegments.length - 1); // 구간 사이 구덩이 수

  let extra = 10 - obstacleCount;
  while (extra > 0) {
    // 가시 구간
    const len = 90 + rand() * 70;
    const seg = { x1: cursor, x2: cursor + len };
    groundSegments.push(seg);
    const sx = cursor + 26 + rand() * Math.max(5, len - 52);
    spikes.push({ x: sx, w: 22 });
    cursor += len;
    extra--;

    // 작은 구덩이(낙사 구간)도 장애물로 추가
    if (extra > 0) {
      cursor += 60 + rand() * 60; // 구덩이
      const land = 80 + rand() * 50;
      groundSegments.push({ x1: cursor, x2: cursor + land });
      cursor += land;
      extra--;
    }
  }

  // 골 구간 (항상 마지막에 한 번만)
  const goalPad = 240;
  groundSegments.push({ x1: cursor, x2: cursor + goalPad });
  const goalX = cursor + goalPad / 2;
  cursor += goalPad;

  return {
    id: levelNumber,
    width: cursor + 100,
    start: { x: START_X, y: C.GROUND_Y - C.BALL_RADIUS },
    groundSegments,
    platforms,
    spikes,
    movingSpikes,
    goal: { x: goalX, y: C.GROUND_Y },
  };
}

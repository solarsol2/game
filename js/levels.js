// 레벨 절차적 생성기. 레벨 번호를 시드로 사용해 항상 같은 스테이지를 생성한다.
// 총 10단계(GAME_CONST.TOTAL_LEVELS)로, 단계가 올라갈수록
// 바닥 구덩이 → 가시 → 공중 발판 순으로 요소가 늘어난다.

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
  const difficulty = Math.min(1, (levelNumber - 1) / (C.TOTAL_LEVELS - 1)); // 0~1

  const groundSegments = [];
  const platforms = [];
  const spikes = [];
  const movingSpikes = [];

  const START_X = 120;
  const SAFE_START_LEN = 260;

  let cursor = START_X;
  groundSegments.push({ x1: 0, x2: START_X + SAFE_START_LEN });
  cursor += SAFE_START_LEN;

  const maxGap = 120 + difficulty * 140;                           // 120~260
  const spikeChance       = levelNumber <= 2 ? 0 : Math.min(0.75, 0.35 + difficulty * 0.45); // 더 많은 가시
  const movingSpikeChance = levelNumber <= 3 ? 0 : Math.min(0.50, 0.10 + difficulty * 0.50);
  const detourChance      = levelNumber <= 2 ? 0 : Math.min(0.40, 0.15 + difficulty * 0.40);
  const stepChance        = levelNumber <= 2 ? 0 : Math.min(0.30, 0.10 + difficulty * 0.35);
  const segCount = 8 + Math.floor(levelNumber * 0.9); // 8~17 (더 많은 구간)

  for (let i = 0; i < segCount; i++) {
    const roll = rand();

    if (roll < detourChance) {
      // 구덩이 + 중간 공중 발판 (낭떠러지 더 길게)
      const gapLen = 100 + rand() * maxGap;
      const gapStart = cursor;
      cursor += gapLen;

      const platW = Math.max(65, 140 - difficulty * 60);
      const platY = C.GROUND_Y - (65 + rand() * 70);
      const platX1 = gapStart + gapLen / 2 - platW / 2;

      platforms.push({ x1: platX1, x2: platX1 + platW, y: platY });

      const nextLen = 100 + rand() * 80; // 착지 구간 짧게
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else if (roll < detourChance + stepChance) {
      // 계단식 연속 발판 구간
      const numPlats = 2 + Math.floor(rand() * 2);
      const platW = 60 + rand() * 30;
      const platSpacing = 85 + rand() * 45;
      const totalGap = platSpacing * (numPlats + 1);
      const gapStart = cursor;
      cursor += totalGap;

      for (let p = 0; p < numPlats; p++) {
        const px = gapStart + platSpacing * (p + 1) - platW / 2;
        const py = C.GROUND_Y - (40 + rand() * 40);
        platforms.push({ x1: px, x2: px + platW, y: py });
      }

      const nextLen = 90 + rand() * 70;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else if (roll < detourChance + stepChance + 0.22 + difficulty * 0.1) {
      // 단순 구덩이
      const gapLen = 90 + rand() * (maxGap + 60);
      cursor += gapLen;
      const nextLen = 90 + rand() * 100;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else {
      // 평지 — 길이를 짧게 제한하고 가시 밀도 높임
      const len = 80 + rand() * 100; // 최대 180px (기존 420px → 대폭 축소)
      const seg = { x1: cursor, x2: cursor + len };
      groundSegments.push(seg);

      if (rand() < spikeChance) {
        const spikeCount = 1 + Math.floor(rand() * (2 + Math.floor(difficulty * 2)));
        for (let s = 0; s < spikeCount; s++) {
          const margin = 30;
          const sx = seg.x1 + margin + rand() * Math.max(10, len - margin * 2 - spikeCount * 26);
          spikes.push({ x: sx, w: 22 });
        }
      }

      if (rand() < movingSpikeChance) {
        const margin = 50;
        const bx = seg.x1 + margin + rand() * Math.max(10, len - margin * 2);
        const range = 30 + rand() * 50;
        movingSpikes.push({
          baseX: bx, x: bx, w: 22,
          range,
          speed: 1.2 + rand() * 2.0,
          phase: rand() * Math.PI * 2,
        });
      }

      cursor += len;
    }
  }

  // 골 구간
  const goalPad = 260;
  groundSegments.push({ x1: cursor, x2: cursor + goalPad });
  const goalX = cursor + goalPad / 2;
  cursor += goalPad;

  const levelWidth = cursor + 100;

  return {
    id: levelNumber,
    width: levelWidth,
    start: { x: START_X, y: C.GROUND_Y - C.BALL_RADIUS },
    groundSegments,
    platforms,
    spikes,
    movingSpikes,
    goal: { x: goalX, y: C.GROUND_Y },
  };
}

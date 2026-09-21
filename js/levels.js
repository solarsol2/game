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
  const difficulty = Math.min(1, (levelNumber - 1) / (C.TOTAL_LEVELS - 1)); // 0~1 (10단계 기준)

  const groundSegments = [];
  const platforms = [];
  const spikes = [];

  const START_X = 120;
  const SAFE_START_LEN = 260;

  let cursor = START_X;
  groundSegments.push({ x1: 0, x2: START_X + SAFE_START_LEN });
  cursor += SAFE_START_LEN;

  // 착지 후 한 번의 바운스로 넘을 수 있는 최대 수평 거리(여유 있게 캡)
  const maxGap = 90 + difficulty * 100; // 90 ~ 190
  const spikeChance = levelNumber <= 2 ? 0 : Math.min(0.5, 0.15 + difficulty * 0.4);
  const detourChance = levelNumber <= 3 ? 0 : Math.min(0.4, 0.1 + difficulty * 0.4); // 구덩이+발판 구간
  const segCount = 5 + Math.floor(levelNumber * 0.7); // 5~12

  for (let i = 0; i < segCount; i++) {
    const roll = rand();

    if (roll < detourChance) {
      // 구덩이 + 공중 발판으로 건너야 하는 구간
      const gapLen = 60 + rand() * (maxGap - 40);
      const gapStart = cursor;
      cursor += gapLen;

      const platW = Math.max(70, 150 - difficulty * 70);
      const platY = C.GROUND_Y - (70 + rand() * 60);
      const platX1 = gapStart + gapLen / 2 - platW / 2;

      platforms.push({ x1: platX1, x2: platX1 + platW, y: platY });

      // 발판 뒤에 이어지는 착지 구간
      const nextLen = 160 + rand() * 120;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;
    } else if (roll < detourChance + 0.2 + difficulty * 0.1) {
      // 단순 구덩이(바닥 갭)
      const gapLen = 50 + rand() * maxGap;
      cursor += gapLen;
      const nextLen = 150 + rand() * 150;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;
    } else {
      // 평범한 바닥 구간, 가시 배치 가능
      const len = 200 + rand() * 200;
      const seg = { x1: cursor, x2: cursor + len };
      groundSegments.push(seg);

      if (rand() < spikeChance) {
        const spikeCount = 1 + Math.floor(rand() * (1 + Math.floor(difficulty * 2)));
        for (let s = 0; s < spikeCount; s++) {
          const margin = 40;
          const sx = seg.x1 + margin + rand() * Math.max(10, len - margin * 2 - spikeCount * 30);
          spikes.push({ x: sx, w: 22 });
        }
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
    goal: { x: goalX, y: C.GROUND_Y },
  };
}

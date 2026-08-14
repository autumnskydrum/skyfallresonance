"use client";

import { useEffect, useRef, useState } from "react";

// 논리 좌표계(테이블 내부 좌표) 크기 — 캔버스는 이 해상도로 그리고 CSS로 화면 크기에 맞춰
// 축소 표시한다. 물리 연산은 전부 이 고정 좌표계에서 이루어지므로 화면 크기와 무관하다.
// 세로(포켓볼 앱들의 일반적인 방향)로 바꾸면서 폭/높이를 그대로 맞바꿨다 — 레일/공/포켓 크기
// 비율은 그대로 유지된다.
const TABLE_W = 448;
const TABLE_H = 896;
const RAIL = 28;
const BALL_R = 11;
const POCKET_R = 20;
const LEFT = RAIL + BALL_R;
const RIGHT = TABLE_W - RAIL - BALL_R;
const TOP = RAIL + BALL_R;
const BOTTOM = TABLE_H - RAIL - BALL_R;

const POCKETS = [
  { x: RAIL, y: RAIL },
  { x: TABLE_W - RAIL, y: RAIL },
  { x: RAIL - 4, y: TABLE_H / 2 },
  { x: TABLE_W - RAIL + 4, y: TABLE_H / 2 },
  { x: RAIL, y: TABLE_H - RAIL },
  { x: TABLE_W - RAIL, y: TABLE_H - RAIL },
];

// 마찰이 지수적으로 감쇠하다 보니 STOP_SPEED가 너무 낮으면 눈에 거의 안 보일 만큼 느려진
// 뒤로도 한참을 "멈춘 것으로" 안 쳐서 몇 초씩 미세하게 계속 기어가는 게 느껴졌다 — 문턱을 확
// 올려 눈에 띄게 느려지면 바로 멈춘 걸로 처리한다.
const FRICTION = 0.978;
const STOP_SPEED = 0.35;
const CUSHION_RESTITUTION = 0.9;
const BALL_RESTITUTION = 0.96;
const MAX_PULL = 130;
const POWER_SCALE = 0.15;

// 당점(회전) 관련 — 실제 당구 물리(구름·미끄럼 마찰이 시간에 따라 상호작용하며 만드는 드로우/
// 팔로우)를 정확히 시뮬레이션하진 않는다. 좌우 당점은 이동 중 진행 방향에 수직으로 작은 힘을
// 계속 줘서 곡선으로 휘게 하고(사이드 스핀), 상하 당점은 큐볼이 다른 공과 처음 충돌하는 순간
// 진행 방향으로 한 번 추가 임펄스를 줘서(팔로우샷=앞으로 더 감, 드로우샷=뒤로 끌림) 흉내만
// 낸다 — 그래도 "어느 정도 조절 가능한 스핀"이라는 목적은 충분히 달성한다.
// 처음 값들은 회전 효과가 매 프레임 계속 누적되거나(사이드 스핀) 충돌 순간 속도에 비례해
// 그대로 실려서(상하 스핀) 샷 전체를 지배할 만큼 과했다 — 궤적이 "이상하다"는 피드백 이후
// 눈에 띄되 과하지 않은 수준으로 다 낮췄고, 사이드 스핀은 감쇠도 빠르게 해서 효과가 샷 초반에
// 집중되고(실제 당구에서도 회전이 구름 마찰로 빨리 죽는다) 긴 롤 전체를 휘게 만들지 않는다.
const SIDE_SPIN_CURVE = 0.02;
const SIDE_SPIN_DECAY = 0.95;
const VERTICAL_SPIN_IMPULSE = 0.45;

type BallType = "cue" | "solid" | "stripe" | "eight";
type Ball = {
  number: number; // 0 = 큐볼
  type: BallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  potted: boolean;
  spinX: number; // 큐볼 전용: -1(왼쪽 당점)~1(오른쪽 당점)
  spinY: number; // 큐볼 전용: -1(아래, 드로우)~1(위, 팔로우)
  spinApplied: boolean; // 이번 샷에서 첫 충돌에 상하 당점을 이미 적용했는지
};

// 실제 대회 규정 랙 순서는 아니지만, 8번이 3번째 줄 가운데 오도록 놓은 표준적인 삼각形 배치.
// 큐볼은 아래쪽에 두고 랙은 위쪽에 둔다 — 삼각형의 꼭짓점(1번 공)이 큐볼에 가장 가깝다.
const RACK_ORDER = [1, [9, 2], [3, 8, 10], [11, 4, 12, 5], [13, 6, 14, 7, 15]] as const;

const BALL_COLORS: Record<number, string> = {
  1: "#f6c344",
  2: "#2e5bff",
  3: "#e83a3a",
  4: "#7a3ae8",
  5: "#f07a1e",
  6: "#1f9d55",
  7: "#8a1f2b",
  8: "#1a1a1a",
  9: "#f6c344",
  10: "#2e5bff",
  11: "#e83a3a",
  12: "#7a3ae8",
  13: "#f07a1e",
  14: "#1f9d55",
  15: "#8a1f2b",
};

function ballType(number: number): BallType {
  if (number === 0) return "cue";
  if (number === 8) return "eight";
  return number < 8 ? "solid" : "stripe";
}

function makeCueBall(): Ball {
  return {
    number: 0,
    type: "cue",
    x: TABLE_W / 2,
    y: TABLE_H - RAIL - 160,
    vx: 0,
    vy: 0,
    potted: false,
    spinX: 0,
    spinY: 0,
    spinApplied: false,
  };
}

function makeRack(): Ball[] {
  const balls: Ball[] = [makeCueBall()];
  const apexX = TABLE_W / 2;
  const apexY = TABLE_H - RAIL - 380;
  const rowSpacing = BALL_R * 1.75; // 줄 사이(세로) 간격
  const withinSpacing = BALL_R * 2.02; // 같은 줄 안(가로) 간격
  RACK_ORDER.forEach((row, rowIndex) => {
    const numbers = Array.isArray(row) ? row : [row];
    const rowY = apexY - rowIndex * rowSpacing;
    const startX = apexX - ((numbers.length - 1) * withinSpacing) / 2;
    numbers.forEach((num, i) => {
      balls.push({
        number: num,
        type: ballType(num),
        x: startX + i * withinSpacing,
        y: rowY,
        vx: 0,
        vy: 0,
        potted: false,
        spinX: 0,
        spinY: 0,
        spinApplied: false,
      });
    });
  });
  return balls;
}

function allStopped(balls: Ball[]): boolean {
  return balls.every((b) => b.potted || (Math.abs(b.vx) < 1e-6 && Math.abs(b.vy) < 1e-6));
}

function physicsStep(balls: Ball[]) {
  for (const b of balls) {
    if (b.potted) continue;

    // 사이드 스핀: 진행 방향에 수직으로 작은 힘을 계속 줘서 곡선으로 휘게 한다. 속도가
    // 붙어 있을 때만 의미가 있고(방향이 없으면 어느 쪽으로 휠지 정의가 안 된다), 마찰과
    // 비슷한 속도로 감쇠시켜 회전이 서서히 죽도록 한다.
    if (b.spinX !== 0) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 0.05) {
        const dirX = b.vx / speed;
        const dirY = b.vy / speed;
        b.vx += -dirY * b.spinX * SIDE_SPIN_CURVE;
        b.vy += dirX * b.spinX * SIDE_SPIN_CURVE;
      }
      b.spinX *= SIDE_SPIN_DECAY;
      if (Math.abs(b.spinX) < 0.01) b.spinX = 0;
    }

    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.hypot(b.vx, b.vy) < STOP_SPEED) {
      b.vx = 0;
      b.vy = 0;
    }
  }

  for (const b of balls) {
    if (b.potted) continue;
    if (b.x < LEFT) {
      b.x = LEFT;
      b.vx *= -CUSHION_RESTITUTION;
    } else if (b.x > RIGHT) {
      b.x = RIGHT;
      b.vx *= -CUSHION_RESTITUTION;
    }
    if (b.y < TOP) {
      b.y = TOP;
      b.vy *= -CUSHION_RESTITUTION;
    } else if (b.y > BOTTOM) {
      b.y = BOTTOM;
      b.vy *= -CUSHION_RESTITUTION;
    }
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      if (a.potted || b.potted) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < BALL_R * 2) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_R * 2 - dist;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const relVel = rvx * nx + rvy * ny;
        if (relVel < 0) {
          // 상하 당점(팔로우/드로우): 큐볼이 이번 샷 들어 처음으로 다른 공과 부딪히는
          // 순간, 부딪히기 직전 진행 방향으로 한 번 더 힘을 준다 — 위쪽 당점(양수)이면
          // 앞으로 더 밀려나가는 팔로우샷, 아래쪽 당점(음수)이면 반대로 끌려오는 드로우샷.
          for (const cue of [a, b]) {
            if (cue.type === "cue" && !cue.spinApplied && cue.spinY !== 0) {
              const speed = Math.hypot(cue.vx, cue.vy);
              if (speed > 0.01) {
                const dirX = cue.vx / speed;
                const dirY = cue.vy / speed;
                const kick = cue.spinY * VERTICAL_SPIN_IMPULSE * speed;
                cue.vx += dirX * kick;
                cue.vy += dirY * kick;
              }
              cue.spinApplied = true;
            }
          }

          const impulse = (-(1 + BALL_RESTITUTION) * relVel) / 2;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
        }
      }
    }
  }

  const newlyPotted: Ball[] = [];
  for (const b of balls) {
    if (b.potted) continue;
    for (const p of POCKETS) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
        b.potted = true;
        b.vx = 0;
        b.vy = 0;
        newlyPotted.push(b);
        break;
      }
    }
  }
  return newlyPotted;
}

// 조준선이 막힐 때까지(다른 공이나 쿠션에 닿을 때까지) 뻗어나갈 거리를 구한다 — 큐볼을 점으로,
// 다른 공은 반지름을 2*BALL_R로 키운 원으로 취급하는 표준적인 레이캐스트 트릭.
// 조준선/예측선이 막힐 때까지(다른 공이나 쿠션에 닿을 때까지) 뻗어나갈 거리를 구한다 — 쏘는
// 공을 점으로, 다른 공은 반지름을 2*BALL_R로 키운 원으로 취급하는 표준적인 레이캐스트 트릭.
// 어떤 공에 먼저 맞는지도 같이 돌려준다 — "맞은 공이 어디로 갈지" 예측선을 그리려면 그 공이
// 뭔지 알아야 한다.
function raycastBalls(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  balls: Ball[],
  excludeNumbers: Set<number>
): { dist: number; ball: Ball | null } {
  let maxDist = Infinity;
  if (dirX > 0) maxDist = Math.min(maxDist, (RIGHT - originX) / dirX);
  else if (dirX < 0) maxDist = Math.min(maxDist, (LEFT - originX) / dirX);
  if (dirY > 0) maxDist = Math.min(maxDist, (BOTTOM - originY) / dirY);
  else if (dirY < 0) maxDist = Math.min(maxDist, (TOP - originY) / dirY);

  let hitBall: Ball | null = null;
  for (const b of balls) {
    if (b.potted || excludeNumbers.has(b.number)) continue;
    const lx = b.x - originX;
    const ly = b.y - originY;
    const tca = lx * dirX + ly * dirY;
    if (tca <= 0) continue;
    const d2 = lx * lx + ly * ly - tca * tca;
    const r2 = BALL_R * 2 * (BALL_R * 2);
    if (d2 > r2) continue;
    const thc = Math.sqrt(r2 - d2);
    const t0 = tca - thc;
    if (t0 > 0 && t0 < maxDist) {
      maxDist = t0;
      hitBall = b;
    }
  }
  return { dist: maxDist, ball: hitBall };
}

type PathPoint = { x: number; y: number };

// 조준 미리보기용 실제 경로 시뮬레이션 — 직선 레이캐스트 대신 physicsStep과 똑같은 프레임별
// 갱신식(마찰, 사이드 스핀 커브)을 그대로 밟아가며 앞으로 걸어본다. 좌우 당점(사이드 스핀)이
// 걸려 있으면 실제 큐볼 경로가 휘어서, 직선으로만 계산하던 예전 방식은 어떤 공을 먼저 맞는지
// 자체를 잘못 예측했다 — "예측선이 안 맞는다"는 피드백의 핵심 원인. 물리 루프를 그대로
// 재현하면 회전이 없을 때는 자동으로 직선과 똑같아지고, 있을 때도 실제와 일치한다.
function simulateCuePath(
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  speed: number,
  spinX: number,
  balls: Ball[]
): { path: PathPoint[]; hitBall: Ball | null; hitX: number; hitY: number } {
  let x = startX;
  let y = startY;
  let vx = dirX * speed;
  let vy = dirY * speed;
  let spin = spinX;
  const path: PathPoint[] = [{ x, y }];
  let hitBall: Ball | null = null;

  for (let i = 0; i < 500; i++) {
    const curSpeed = Math.hypot(vx, vy);
    if (curSpeed < STOP_SPEED) break;

    if (spin !== 0) {
      const dx = vx / curSpeed;
      const dy = vy / curSpeed;
      vx += -dy * spin * SIDE_SPIN_CURVE;
      vy += dx * spin * SIDE_SPIN_CURVE;
      spin *= SIDE_SPIN_DECAY;
      if (Math.abs(spin) < 0.01) spin = 0;
    }

    x += vx;
    y += vy;
    vx *= FRICTION;
    vy *= FRICTION;
    path.push({ x, y });

    if (x < LEFT || x > RIGHT || y < TOP || y > BOTTOM) break;

    for (const b of balls) {
      if (b.potted || b.number === 0) continue;
      if (Math.hypot(x - b.x, y - b.y) < BALL_R * 2) {
        hitBall = b;
        break;
      }
    }
    if (hitBall) break;
  }

  const last = path[path.length - 1];
  return { path, hitBall, hitX: last.x, hitY: last.y };
}

function drawTable(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, TABLE_W, TABLE_H);
  ctx.fillStyle = "#3a2417";
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);
  ctx.fillStyle = "#0e6b3a";
  ctx.fillRect(RAIL, RAIL, TABLE_W - RAIL * 2, TABLE_H - RAIL * 2);
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(RAIL, RAIL, TABLE_W - RAIL * 2, TABLE_H - RAIL * 2);

  for (const p of POCKETS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0a0a";
    ctx.fill();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball) {
  if (b.potted) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
  ctx.closePath();

  if (b.type === "cue") {
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
  } else if (b.type === "stripe") {
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = BALL_COLORS[b.number];
    ctx.fillRect(b.x - BALL_R, b.y - BALL_R * 0.55, BALL_R * 2, BALL_R * 1.1);
    ctx.restore();
  } else {
    ctx.fillStyle = BALL_COLORS[b.number] ?? "#999";
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  ctx.stroke();

  if (b.number !== 0) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `${BALL_R * 0.55}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.number), b.x, b.y + 0.5);
  }
  ctx.restore();
}

type Turn = 1 | 2;
type Group = "solid" | "stripe";
type Spin = { x: number; y: number };

export function PoolGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spinCanvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>(makeRack());
  const rafRef = useRef(0);
  const aimingRef = useRef(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const turnBallsPottedRef = useRef<Ball[]>([]);
  const shotInFlightRef = useRef(false);
  const spinRef = useRef<Spin>({ x: 0, y: 0 });
  const spinDraggingRef = useRef(false);
  // 애니메이션 루프(마운트 시 한 번만 만들어지는 클로저)가 최신 값을 읽어야 해서 ref로 들고
  // 있는다 — showPrediction 상태는 버튼 표시(눌린 상태 스타일)에만 쓴다.
  const showPredictionRef = useRef(true);

  const [turn, setTurn] = useState<Turn>(1);
  const [groups, setGroups] = useState<Record<Turn, Group | null>>({ 1: null, 2: null });
  const [message, setMessage] = useState("플레이어 1의 차례입니다 — 큐볼을 드래그해서 치세요");
  const [gameOver, setGameOver] = useState(false);
  const [canShoot, setCanShoot] = useState(true);
  const [showPrediction, setShowPrediction] = useState(true);

  // 공이 멈췄을 때 턴을 정리하는 로직 — turn/groups라는 "현재 렌더의" 상태를 그대로 참조한다.
  // 애니메이션 루프(아래)는 마운트 시 한 번만 만들어지는 클로저라 이 함수를 직접 캡처하면 항상
  // 마운트 시점의 turn=1 상태만 보게 된다 — 그래서 resolveTurn 자체는 매 렌더 새로 만들어 두고,
  // ref(resolveTurnRef)에 최신 버전을 담아두고(렌더 중이 아니라 effect에서, 렌더 순수성 규칙 때문)
  // 루프는 그 ref를 통해서만 호출한다.
  const resolveTurnRef = useRef<() => void>(() => {});
  function resolveTurn() {
    const balls = ballsRef.current;
    const potted = turnBallsPottedRef.current;
    turnBallsPottedRef.current = [];
    const cueBall = balls.find((b) => b.number === 0)!;

    const scratched = cueBall.potted;
    const pottedEight = potted.some((b) => b.number === 8);
    const pottedOwn = (player: Turn) => {
      const g = groups[player];
      if (!g) return potted.some((b) => b.number !== 0 && b.number !== 8);
      return potted.some((b) => (g === "solid" ? b.number < 8 : b.number > 8) && b.number !== 8);
    };

    if (pottedEight) {
      const group = groups[turn];
      const cleared =
        group != null &&
        balls.every((b) => (group === "solid" ? b.number >= 8 || b.potted : b.number <= 8 || b.potted));
      const win = cleared && !scratched;
      setGameOver(true);
      setCanShoot(false);
      setMessage(
        win
          ? `플레이어 ${turn}이(가) 8번 공을 넣어 승리했습니다! 🎉`
          : `플레이어 ${turn}이(가) 규칙을 어기고 8번 공을 넣어 패배했습니다.`
      );
      return;
    }

    if (scratched) {
      cueBall.potted = false;
      cueBall.x = TABLE_W / 2;
      cueBall.y = TABLE_H - RAIL - 160;
      cueBall.vx = 0;
      cueBall.vy = 0;
    }

    let nextGroups = groups;
    if (!groups[1] && !groups[2] && potted.some((b) => b.number !== 0 && b.number !== 8)) {
      const first = potted.find((b) => b.number !== 0 && b.number !== 8)!;
      const firstGroup: Group = first.number < 8 ? "solid" : "stripe";
      const otherGroup: Group = firstGroup === "solid" ? "stripe" : "solid";
      nextGroups = { 1: turn === 1 ? firstGroup : otherGroup, 2: turn === 2 ? firstGroup : otherGroup };
      setGroups(nextGroups);
    }

    const continues = !scratched && pottedOwn(turn);
    const nextTurn: Turn = continues ? turn : turn === 1 ? 2 : 1;
    setTurn(nextTurn);

    const groupLabel = (t: Turn) =>
      nextGroups[t] === "solid" ? "솔리드(1~7번)" : nextGroups[t] === "stripe" ? "스트라이프(9~15번)" : "";
    if (scratched) {
      setMessage(`스크래치! 큐볼이 포켓에 들어갔습니다 — 플레이어 ${nextTurn}의 차례입니다`);
    } else {
      const suffix = groupLabel(nextTurn) ? ` (${groupLabel(nextTurn)})` : "";
      setMessage(`플레이어 ${nextTurn}의 차례입니다${suffix}`);
    }
    setCanShoot(true);
  }

  // 렌더 도중이 아니라 커밋 이후에 최신 resolveTurn을 ref에 담는다 — 매 렌더마다(의존성 배열
  // 없이) 실행돼 애니메이션 루프가 항상 방금 렌더된 turn/groups를 보는 최신 버전을 부르게 한다.
  useEffect(() => {
    resolveTurnRef.current = resolveTurn;
  });

  function drawSpinWidget() {
    const canvas = spinCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    const r = size / 2 - 3;
    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(0,0,0,.3)";
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    const mx = cx + spinRef.current.x * r;
    // spinY는 위=양수인데 화면 y는 아래로 갈수록 커지므로, 마커를 그릴 때 부호를 다시
    // 뒤집어야 값과 실제로 표시되는 위치(위/아래)가 서로 맞는다 — spinPointFromEvent의
    // 반대 방향 변환.
    const my = cy - spinRef.current.y * r;
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#e83a3a";
    ctx.fill();
  }

  useEffect(() => {
    drawSpinWidget();
  }, []);

  // 물리 루프는 React 상태가 아니라 ballsRef를 직접 읽고 써서 매 프레임 리렌더를 피한다 —
  // 공이 멈췄을 때만(턴이 넘어갈 때만) resolveTurnRef를 통해 React 상태를 갱신해 UI를 다시 그린다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function frame() {
      const balls = ballsRef.current;
      if (shotInFlightRef.current) {
        const potted = physicsStep(balls);
        if (potted.length > 0) turnBallsPottedRef.current.push(...potted);
        if (allStopped(balls)) {
          shotInFlightRef.current = false;
          resolveTurnRef.current();
        }
      }
      drawTable(ctx);
      for (const b of balls) drawBall(ctx, b);
      if (aimingRef.current) drawAim(ctx);
      rafRef.current = requestAnimationFrame(frame);
    }

    function drawAim(ctx: CanvasRenderingContext2D) {
      const cue = ballsRef.current.find((b) => b.number === 0 && !b.potted);
      if (!cue) return;
      const { x: px, y: py } = dragRef.current;
      const pullDx = cue.x - px;
      const pullDy = cue.y - py;
      const pullDist = Math.min(Math.hypot(pullDx, pullDy), MAX_PULL);
      if (pullDist < 4) return;
      const hyp = Math.hypot(pullDx, pullDy);
      const nx = pullDx / hyp;
      const ny = pullDy / hyp;

      // 사이드 스핀이 걸려 있으면 실제 큐볼 경로가 휘므로, 직선이 아니라 실제 물리와 같은
      // 방식으로 앞으로 걸어본 시뮬레이션 경로를 그린다 — 회전이 없으면 자동으로 직선이 된다.
      const sim = simulateCuePath(cue.x, cue.y, nx, ny, pullDist * POWER_SCALE, spinRef.current.x, ballsRef.current);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(sim.path[0].x, sim.path[0].y);
      for (let i = 1; i < sim.path.length; i++) ctx.lineTo(sim.path[i].x, sim.path[i].y);
      ctx.stroke();

      // 처음 맞은 공이 어디로 갈지 — 충돌 순간 큐볼 중심(시뮬레이션이 찾아낸 실제 접촉점)에서
      // 그 공 중심을 지나는 직선 방향(스핀 없는 이상적인 충돌 가정, "고스트볼" 조준 방식과
      // 동일한 원리 — 맞는 공의 방향 자체는 여전히 직선 근사다, 첫 접촉 지점만 정확해졌다).
      if (showPredictionRef.current && sim.hitBall) {
        const target = sim.hitBall;
        const odx = target.x - sim.hitX;
        const ody = target.y - sim.hitY;
        const olen = Math.hypot(odx, ody);
        if (olen > 0.001) {
          const odirX = odx / olen;
          const odirY = ody / olen;
          const secondHit = raycastBalls(target.x, target.y, odirX, odirY, ballsRef.current, new Set([0, target.number]));
          ctx.strokeStyle = "rgba(120,210,255,.85)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(target.x, target.y);
          ctx.lineTo(target.x + odirX * secondHit.dist, target.y + odirY * secondHit.dist);
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,200,120,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cue.x - nx * (pullDist + BALL_R + 6), cue.y - ny * (pullDist + BALL_R + 6));
      ctx.lineTo(cue.x - nx * (BALL_R + 6), cue.y - ny * (BALL_R + 6));
      ctx.stroke();

      const powerPct = Math.round((pullDist / MAX_PULL) * 100);
      const labelX = cue.x - nx * (pullDist + BALL_R + 26);
      const labelY = cue.y - ny * (pullDist + BALL_R + 26);
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.strokeText(`${powerPct}%`, labelX, labelY);
      ctx.fillStyle = "rgba(255,200,120,.95)";
      ctx.fillText(`${powerPct}%`, labelX, labelY);
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function toLogicalCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = TABLE_W / rect.width;
    const scaleY = TABLE_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canShoot || gameOver || shotInFlightRef.current) return;
    const pos = toLogicalCoords(e);
    aimingRef.current = true;
    dragRef.current = pos;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!aimingRef.current) return;
    dragRef.current = toLogicalCoords(e);
  }

  function handlePointerUp() {
    if (!aimingRef.current) return;
    aimingRef.current = false;
    const cue = ballsRef.current.find((b) => b.number === 0 && !b.potted);
    if (!cue) return;
    const { x: px, y: py } = dragRef.current;
    const dx = cue.x - px;
    const dy = cue.y - py;
    const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
    if (dist < 4) return;
    const nx = dx / Math.hypot(dx, dy);
    const ny = dy / Math.hypot(dx, dy);
    cue.vx = nx * dist * POWER_SCALE;
    cue.vy = ny * dist * POWER_SCALE;
    cue.spinX = spinRef.current.x;
    cue.spinY = spinRef.current.y;
    cue.spinApplied = false;
    shotInFlightRef.current = true;
    setCanShoot(false);
    setMessage("공이 움직이는 중...");
  }

  function spinPointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const size = canvas.width;
    const scale = size / rect.width;
    const r = size / 2 - 3;
    const cx = size / 2;
    const cy = size / 2;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    let ox = (px - cx) / r;
    // 화면 좌표는 아래로 갈수록 y가 커지지만, spinY는 "위(양수)=팔로우, 아래(음수)=드로우"로
    // 정의했다 — 부호를 뒤집지 않으면 위젯에서 공 아래쪽(시각적으로 드로우 지점)을 눌렀는데
    // 양수 spinY(팔로우)가 나가는 버그가 된다. 실제로 궤적이 반대로 나온다는 피드백의 원인이었다.
    let oy = -(py - cy) / r;
    const mag = Math.hypot(ox, oy);
    if (mag > 1) {
      ox /= mag;
      oy /= mag;
    }
    return { x: ox, y: oy };
  }

  function handleSpinPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    spinDraggingRef.current = true;
    spinRef.current = spinPointFromEvent(e);
    drawSpinWidget();
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleSpinPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!spinDraggingRef.current) return;
    spinRef.current = spinPointFromEvent(e);
    drawSpinWidget();
  }

  function handleSpinPointerUp() {
    spinDraggingRef.current = false;
  }

  function resetSpin() {
    spinRef.current = { x: 0, y: 0 };
    drawSpinWidget();
  }

  function togglePrediction() {
    const next = !showPredictionRef.current;
    showPredictionRef.current = next;
    setShowPrediction(next);
  }

  function restart() {
    ballsRef.current = makeRack();
    turnBallsPottedRef.current = [];
    shotInFlightRef.current = false;
    spinRef.current = { x: 0, y: 0 };
    drawSpinWidget();
    setTurn(1);
    setGroups({ 1: null, 2: null });
    setGameOver(false);
    setCanShoot(true);
    setMessage("플레이어 1의 차례입니다 — 큐볼을 드래그해서 치세요");
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-4 text-sm">
        <p className="font-medium">{message}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePrediction}
            aria-pressed={showPrediction}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              showPrediction
                ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
                : "border-black/[.15] hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.08]"
            }`}
          >
            예측선 {showPrediction ? "끄기" : "켜기"}
          </button>
          <button
            type="button"
            onClick={restart}
            className="rounded-full border border-black/[.15] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.08]"
          >
            다시 시작
          </button>
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-2">
        <canvas
          ref={spinCanvasRef}
          width={128}
          height={128}
          onPointerDown={handleSpinPointerDown}
          onPointerMove={handleSpinPointerMove}
          onPointerUp={handleSpinPointerUp}
          className="h-20 w-20 touch-none rounded-full shadow-inner"
        />
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">당점</span>
          <button
            type="button"
            onClick={resetSpin}
            className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            초기화
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={TABLE_W}
        height={TABLE_H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="block h-[min(82vh,880px)] max-w-[94vw] touch-none rounded-lg shadow-lg [aspect-ratio:1/2]"
      />
      <p className="max-w-[420px] text-center text-xs text-zinc-500 dark:text-zinc-400">
        큐볼 뒤에서 원하는 방향 반대쪽으로 드래그한 뒤 놓으면 그 방향으로 칩니다. 멀리 끌수록 세게 치고,
        당길 때 옆에 %로 힘이 표시돼요. 하늘색 점선은 처음 맞는 공이 어디로 갈지 보여주는 예측선이고,
        위 버튼으로 껐다 켤 수 있습니다. 오른쪽 위 작은 원(당점)을 눌러 큐볼의 어느 지점을 칠지 정하면
        회전을 줄 수 있어요 — 위/아래는 팔로우·드로우, 좌/우는 휘어지는 사이드 스핀입니다.
      </p>
    </div>
  );
}

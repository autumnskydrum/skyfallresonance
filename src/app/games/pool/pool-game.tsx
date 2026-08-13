"use client";

import { useEffect, useRef, useState } from "react";

// 논리 좌표계(테이블 내부 좌표) 크기 — 캔버스는 이 해상도로 그리고 CSS로 화면 폭에 맞춰
// 축소 표시한다. 물리 연산은 전부 이 고정 좌표계에서 이루어지므로 화면 크기와 무관하다.
const TABLE_W = 896;
const TABLE_H = 448;
const RAIL = 28;
const BALL_R = 11;
const POCKET_R = 20;
const LEFT = RAIL + BALL_R;
const RIGHT = TABLE_W - RAIL - BALL_R;
const TOP = RAIL + BALL_R;
const BOTTOM = TABLE_H - RAIL - BALL_R;

const POCKETS = [
  { x: RAIL, y: RAIL },
  { x: TABLE_W / 2, y: RAIL - 4 },
  { x: TABLE_W - RAIL, y: RAIL },
  { x: RAIL, y: TABLE_H - RAIL },
  { x: TABLE_W / 2, y: TABLE_H - RAIL + 4 },
  { x: TABLE_W - RAIL, y: TABLE_H - RAIL },
];

// 마찰이 지수적으로 감쇠하다 보니 STOP_SPEED가 너무 낮으면(처음 값 0.04) 눈에 거의 안 보일
// 만큼 느려진 뒤로도 한참을 "멈춘 것으로" 안 쳐서 몇 초씩 미세하게 계속 기어가는 게 느껴졌다 —
// 문턱을 확 올려 눈에 띄게 느려지면 바로 멈춘 걸로 처리한다. FRICTION도 같이 낮춰 전체
// 감속 자체를 더 빠르게 했다.
const FRICTION = 0.978;
const STOP_SPEED = 0.35;
const CUSHION_RESTITUTION = 0.9;
const BALL_RESTITUTION = 0.96;
const MAX_PULL = 130;
const POWER_SCALE = 0.22;

type BallType = "cue" | "solid" | "stripe" | "eight";
type Ball = {
  id: number;
  number: number; // 0 = 큐볼
  type: BallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  potted: boolean;
};

// 실제 대회 규정 랙 순서는 아니지만, 8번이 3번째 줄 가운데 오도록 놓은 표준적인 삼각形 배치.
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

function makeRack(): Ball[] {
  const balls: Ball[] = [
    { id: 0, number: 0, type: "cue", x: RAIL + 180, y: TABLE_H / 2, vx: 0, vy: 0, potted: false },
  ];
  const apexX = TABLE_W - RAIL - 190;
  const apexY = TABLE_H / 2;
  const dx = BALL_R * 1.75;
  const dy = BALL_R * 2.02;
  let id = 1;
  RACK_ORDER.forEach((row, rowIndex) => {
    const numbers = Array.isArray(row) ? row : [row];
    const rowX = apexX + rowIndex * dx;
    const startY = apexY - ((numbers.length - 1) * dy) / 2;
    numbers.forEach((num, i) => {
      balls.push({
        id: id++,
        number: num,
        type: ballType(num),
        x: rowX,
        y: startY + i * dy,
        vx: 0,
        vy: 0,
        potted: false,
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

export function PoolGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>(makeRack());
  const rafRef = useRef(0);
  const aimingRef = useRef(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const turnBallsPottedRef = useRef<Ball[]>([]);
  const shotInFlightRef = useRef(false);

  const [turn, setTurn] = useState<Turn>(1);
  const [groups, setGroups] = useState<Record<Turn, Group | null>>({ 1: null, 2: null });
  const [message, setMessage] = useState("플레이어 1의 차례입니다 — 큐볼을 드래그해서 치세요");
  const [gameOver, setGameOver] = useState(false);
  const [canShoot, setCanShoot] = useState(true);

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
      cueBall.x = RAIL + 180;
      cueBall.y = TABLE_H / 2;
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
      const dx = cue.x - px;
      const dy = cue.y - py;
      const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
      if (dist < 4) return;
      const nx = dx / Math.hypot(dx, dy);
      const ny = dy / Math.hypot(dx, dy);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(cue.x + nx * 220, cue.y + ny * 220);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,200,120,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cue.x - nx * (dist + BALL_R + 6), cue.y - ny * (dist + BALL_R + 6));
      ctx.lineTo(cue.x - nx * (BALL_R + 6), cue.y - ny * (BALL_R + 6));
      ctx.stroke();
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
    shotInFlightRef.current = true;
    setCanShoot(false);
    setMessage("공이 움직이는 중...");
  }

  function restart() {
    ballsRef.current = makeRack();
    turnBallsPottedRef.current = [];
    shotInFlightRef.current = false;
    setTurn(1);
    setGroups({ 1: null, 2: null });
    setGameOver(false);
    setCanShoot(true);
    setMessage("플레이어 1의 차례입니다 — 큐볼을 드래그해서 치세요");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[896px] items-center justify-between text-sm">
        <p className="font-medium">{message}</p>
        <button
          type="button"
          onClick={restart}
          className="rounded-full border border-black/[.15] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.08]"
        >
          다시 시작
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={TABLE_W}
        height={TABLE_H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full max-w-[896px] touch-none rounded-lg shadow-lg"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        큐볼 뒤에서 원하는 방향 반대쪽으로 드래그한 뒤 놓으면 그 방향으로 칩니다. 멀리 끌수록 세게 칩니다.
      </p>
    </div>
  );
}

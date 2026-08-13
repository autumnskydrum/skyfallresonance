"use client";

import { useEffect, useRef } from "react";
import type { VisualCondition } from "./condition";

// artifact e61fdd82("날씨 디자인 시안 2")의 makeFalling/makeEmbers를 그대로 옮긴 캔버스 파티클
// 엔진 — 비/눈은 같은 캔버스에 물리 특성만 다른 새 인스턴스를 매번 새로 만들어 그린다(원본과
// 동일한 이유: 빗줄기와 눈송이는 갱신 로직 자체가 달라 한 인스턴스로 kind만 바꿀 수 없다).
type FallingOpts = {
  style: "rain" | "snow";
  color: string;
  count: number;
  speedMin: number;
  speedMax: number;
  lengthMin?: number;
  lengthMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  lineWidth?: number;
  angleX?: number;
  alpha?: number;
  driftAmp?: number;
};

type FallingParticle = {
  x: number;
  y: number;
  len: number;
  speed: number;
  drift: number;
  r: number;
  phase: number;
};

type Engine = { start: () => void; stop: () => void; resize: () => void };

function makeFalling(canvas: HTMLCanvasElement, opts: FallingOpts, reduceMotion: boolean): Engine {
  const ctx = canvas.getContext("2d")!;
  let particles: FallingParticle[] = [];
  let running = false;
  let raf = 0;

  function size() {
    const r = canvas.parentElement!.getBoundingClientRect();
    canvas.width = Math.max(1, r.width);
    canvas.height = Math.max(1, r.height);
  }
  function reset(initial: boolean): FallingParticle {
    const w = canvas.width;
    const h = canvas.height;
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : -20,
      len: (opts.lengthMin ?? 0) + Math.random() * ((opts.lengthMax ?? 0) - (opts.lengthMin ?? 0)),
      speed: opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin),
      drift: (Math.random() - 0.5) * (opts.driftAmp ?? 0),
      r:
        opts.style === "snow"
          ? (opts.sizeMin ?? 0) + Math.random() * ((opts.sizeMax ?? 0) - (opts.sizeMin ?? 0))
          : 0,
      phase: Math.random() * Math.PI * 2,
    };
  }
  function spawn() {
    particles = [];
    for (let i = 0; i < opts.count; i++) particles.push(reset(true));
  }
  function tick() {
    if (!running) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = opts.color;
    ctx.fillStyle = opts.color;
    ctx.lineWidth = opts.lineWidth ?? 1;
    ctx.shadowBlur = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (opts.style === "snow") {
        p.phase += 0.02;
        p.x += Math.sin(p.phase) * 0.6 + p.drift * 0.02;
        p.y += p.speed;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.y - p.r > h) particles[i] = reset(false);
      } else {
        p.x += p.drift * 0.05 + (opts.angleX ?? 0);
        p.y += p.speed;
        ctx.globalAlpha = opts.alpha ?? 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (opts.angleX ?? 0) * (p.len / opts.speedMax), p.y + p.len);
        ctx.stroke();
        if (p.y - p.len > h) particles[i] = reset(false);
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  function start() {
    size();
    spawn();
    if (running) return;
    running = true;
    if (reduceMotion) {
      tick();
      running = false;
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  return { start, stop, resize: size };
}

type EmberParticle = { x: number; y: number; r: number; speed: number; drift: number; alpha: number; phase: number };

function makeEmbers(
  canvas: HTMLCanvasElement,
  opts: { color: string; count: number },
  reduceMotion: boolean
): Engine {
  const ctx = canvas.getContext("2d")!;
  let particles: EmberParticle[] = [];
  let running = false;
  let raf = 0;

  function size() {
    const r = canvas.parentElement!.getBoundingClientRect();
    canvas.width = Math.max(1, r.width);
    canvas.height = Math.max(1, r.height);
  }
  function reset(initial: boolean): EmberParticle {
    const w = canvas.width;
    const h = canvas.height;
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 1 + Math.random() * 2.4,
      speed: 0.4 + Math.random() * 1.1,
      drift: (Math.random() - 0.5) * 0.6,
      alpha: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    };
  }
  function spawn() {
    particles = [];
    for (let i = 0; i < opts.count; i++) particles.push(reset(true));
  }
  function tick() {
    if (!running) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.phase += 0.03;
      p.y -= p.speed;
      p.x += Math.sin(p.phase) * 0.4 + p.drift * 0.1;
      const a = p.alpha * Math.max(0, 1 - ((h - p.y) / h) * 0.3);
      ctx.beginPath();
      ctx.fillStyle = opts.color;
      ctx.globalAlpha = a;
      ctx.shadowColor = opts.color;
      ctx.shadowBlur = 6;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.y < -10) particles[i] = reset(false);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  function start() {
    size();
    spawn();
    running = true;
    if (reduceMotion) {
      tick();
      running = false;
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  return { start, stop, resize: size };
}

const RAIN_CONFIG: FallingOpts = {
  style: "rain",
  color: "rgba(200,225,255,0.55)",
  count: 140,
  speedMin: 9,
  speedMax: 16,
  lengthMin: 14,
  lengthMax: 26,
  lineWidth: 1.4,
  angleX: -3,
  alpha: 0.55,
};
const SNOW_CONFIG: FallingOpts = {
  style: "snow",
  color: "rgba(255,255,255,0.9)",
  count: 90,
  speedMin: 1.2,
  speedMax: 2.6,
  sizeMin: 1.5,
  sizeMax: 3.2,
  driftAmp: 1,
};
const EMBER_CONFIG = { color: "rgba(255,140,60,0.9)", count: 46 };

// 별 위치는 서버 렌더와 클라이언트 렌더가 항상 같은 값을 내도록 Math.random() 대신 고정
// 시드의 간단한 PRNG로 한 번만 계산해둔다 — 진짜 난수를 쓰면 두 렌더 결과가 어긋나 하이드레이션
// 불일치가 난다.
function seededStars(count: number) {
  let seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 60,
    o: 0.4 + rand() * 0.6,
  }));
}
const STAR_POSITIONS = seededStars(90);

export function WeatherFx({ condition }: { condition: VisualCondition }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rainCanvasRef = useRef<HTMLCanvasElement>(null);
  const emberCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rainCanvas = rainCanvasRef.current;
    const emberCanvas = emberCanvasRef.current;
    let fallingEngine: Engine | null = null;
    let emberEngine: Engine | null = null;

    if (condition === "비" && rainCanvas) {
      fallingEngine = makeFalling(rainCanvas, RAIN_CONFIG, reduceMotion);
      fallingEngine.start();
    } else if (condition === "눈" && rainCanvas) {
      fallingEngine = makeFalling(rainCanvas, SNOW_CONFIG, reduceMotion);
      fallingEngine.start();
    } else if (condition === "폭염" && emberCanvas) {
      emberEngine = makeEmbers(emberCanvas, EMBER_CONFIG, reduceMotion);
      emberEngine.start();
    }

    function handleResize() {
      fallingEngine?.resize();
      emberEngine?.resize();
    }
    window.addEventListener("resize", handleResize);

    // 창 크기는 그대로인데 폰트 로딩이 늦게 끝나 히어로 높이가 뒤늦게 바뀌는 경우(모바일 네트워크가
    // 느릴 때 특히 잘 드러난다) resize 이벤트가 안 뜨는데, 그 타이밍에 캔버스를 이미 잘못된(보통
    // 0에 가까운) 크기로 재놓으면 그 뒤로 다시 맞춰지지 않아 비/눈이 안 보이는 것처럼 보였다.
    // ResizeObserver는 원인과 무관하게 실제 레이아웃 크기가 바뀔 때마다 잡아준다.
    const resizeObserver = new ResizeObserver(handleResize);
    if (rootRef.current) resizeObserver.observe(rootRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      fallingEngine?.stop();
      emberEngine?.stop();
    };
  }, [condition]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      {/* transform/will-change: 캔버스가 blend-mode·blur를 쓰는 형제 엘리먼트와 같은 합성 레이어를
          공유하면 일부 모바일 브라우저가 그 레이어의 리페인트를 건너뛰어 첫 프레임에서 멈춘 것처럼
          보이는 경우가 있다 — 각 캔버스를 강제로 자기 GPU 레이어로 승격시켜 피한다. */}
      <canvas
        ref={rainCanvasRef}
        className="absolute inset-0 block h-full w-full [transform:translateZ(0)] [will-change:transform]"
      />
      <canvas
        ref={emberCanvasRef}
        className="absolute inset-0 block h-full w-full [transform:translateZ(0)] [will-change:transform]"
      />

      {condition === "맑음" && (
        // 420px 원은 데스크톱 900px 폭 기준 크기라 좁은 모바일 화면(콘텐츠 폭 ~350px)에서는
        // 화면 대부분을 뒤덮으며 넘쳐, 좌상단이 아니라 화면 오른쪽 중앙 쪽으로 삐져나온 것처럼
        // 보였다 — 모바일에서는 절반 크기로 줄인다.
        <div
          className="absolute left-[20%] top-[10%] h-[220px] w-[220px] animate-[weather-sun-pulse_6s_ease-in-out_infinite] rounded-full motion-reduce:animate-none sm:h-[420px] sm:w-[420px]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,196,72,.65) 0%, rgba(255,196,72,0) 70%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {condition === "폭염" && (
        <div
          className="absolute left-1/2 top-[34%] h-[320px] w-[320px] animate-[weather-heat-pulse_3.2s_ease-in-out_infinite] rounded-full blur-[2px] motion-reduce:animate-none sm:h-[640px] sm:w-[640px]"
          style={{
            backgroundImage: "radial-gradient(circle, #ff5a1f 0%, transparent 70%)",
            opacity: 0.6,
          }}
        />
      )}

      {condition === "밤" && (
        <div className="absolute inset-0">
          {STAR_POSITIONS.map((s, i) => (
            <span
              key={i}
              className="absolute h-[2px] w-[2px] rounded-full bg-white"
              style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: s.o }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

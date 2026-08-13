"use client";

import { useEffect, useRef } from "react";
import type { VisualCondition } from "./condition";

type Engine = { start: () => void; stop: () => void; resize: () => void };

type EmberParticle = { x: number; y: number; r: number; speed: number; drift: number; alpha: number; phase: number };

// 폭염의 불씨만 캔버스로 남아 있다 — 비/눈은 원래 이 파일의 makeFalling()으로 캔버스에 그렸는데,
// 안드로이드 크롬 실기기에서 배경(조건별 그라디언트)은 정상으로 바뀌는데 캔버스에 그린 빗줄기만
// 전혀 안 보이는 문제가 있었다(2026-08-14, 사용자 실기기 확인). 캔버스 크기 재측정 타이밍
// (ResizeObserver 도입)과 GPU 레이어 강제 승격(transform:translateZ(0))을 시도했지만 둘 다
// 해결하지 못했다 — 안드로이드 크롬 쪽 캔버스 합성 관련 문제로 추정되지만 이 세션에서 실기기를
// 재현할 방법이 없어 원인을 확정하지 못했다. 결국 캔버스를 포기하고 순수 CSS(절대 위치 +
// @keyframes로 top/transform 애니메이션)로 다시 만들었다 — 별(밤)·글로우(맑음/폭염)는 원래도
// CSS 기반이고 문제 보고가 없었으므로, 캔버스 자체가 아니라 CSS 애니메이션 쪽이 이 기기에서
// 더 신뢰도가 높다고 판단했다. 불씨는 위로 떠오르며 흔들리는 움직임이 커서 캔버스 쪽이 표현하기
// 쉬워 일단 남겨뒀다 — 나중에 폭염에서도 같은 증상이 보고되면 이것도 CSS로 옮길 것.
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

const EMBER_CONFIG = { color: "rgba(255,140,60,0.9)", count: 46 };

// 서버 렌더와 클라이언트 렌더가 항상 같은 값을 내도록 Math.random() 대신 고정 시드의 간단한
// PRNG를 쓴다 — 진짜 난수를 쓰면 두 렌더 결과가 어긋나 하이드레이션 불일치가 난다. 별/비/눈이
// 각자 다른 패턴을 갖도록 시드를 다르게 준다.
function makeSeededRandom(seed: number) {
  let s = seed;
  return function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STAR_POSITIONS = (() => {
  const rand = makeSeededRandom(42);
  return Array.from({ length: 90 }, () => ({
    x: rand() * 100,
    y: rand() * 60,
    duration: 1.6 + rand() * 2.8,
    delay: -rand() * 4, // 음수 delay로 마운트 시점부터 각자 다른 위상에서 시작 — 다 같이 반짝이지 않는다.
  }));
})();

const RAIN_PARTICLES = (() => {
  const rand = makeSeededRandom(1337);
  return Array.from({ length: 90 }, () => ({
    left: rand() * 100,
    height: 14 + rand() * 18,
    duration: 0.55 + rand() * 0.45,
    delay: -rand() * 1.2,
  }));
})();

const SNOW_PARTICLES = (() => {
  const rand = makeSeededRandom(90210);
  return Array.from({ length: 70 }, () => ({
    left: rand() * 100,
    size: 2 + rand() * 3.5,
    duration: 6 + rand() * 6,
    delay: -rand() * 10,
    opacity: 0.6 + rand() * 0.35,
  }));
})();

// 좌->우로 아주 느리게 흘러가는 뭉게구름 몇 덩어리 — 실제 구름 모양 대신 sun-glow/heat-shimmer와
// 같은 계열(블러 처리한 부드러운 타원 + screen 블렌드)로 만들어 이 화면의 시각 언어를 유지한다.
const CLOUD_PARTICLES = (() => {
  const rand = makeSeededRandom(4242);
  return Array.from({ length: 4 }, () => ({
    top: 8 + rand() * 40,
    width: 260 + rand() * 220,
    height: 90 + rand() * 60,
    duration: 42 + rand() * 30,
    delay: -rand() * 60,
    opacity: 0.25 + rand() * 0.25,
  }));
})();

export function WeatherFx({ condition }: { condition: VisualCondition }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const emberCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const emberCanvas = emberCanvasRef.current;
    let emberEngine: Engine | null = null;

    if (condition === "폭염" && emberCanvas) {
      emberEngine = makeEmbers(emberCanvas, EMBER_CONFIG, reduceMotion);
      emberEngine.start();
    }

    function handleResize() {
      emberEngine?.resize();
    }
    window.addEventListener("resize", handleResize);

    // 창 크기는 그대로인데 폰트 로딩이 늦게 끝나 히어로 높이가 뒤늦게 바뀌는 경우 resize 이벤트가
    // 안 뜨는데, 그 타이밍에 캔버스를 이미 잘못된 크기로 재놓으면 그 뒤로 다시 맞춰지지 않는다.
    // ResizeObserver는 원인과 무관하게 실제 레이아웃 크기가 바뀔 때마다 잡아준다.
    const resizeObserver = new ResizeObserver(handleResize);
    if (rootRef.current) resizeObserver.observe(rootRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      emberEngine?.stop();
    };
  }, [condition]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <canvas
        ref={emberCanvasRef}
        className="absolute inset-0 block h-full w-full [transform:translateZ(0)] [will-change:transform]"
      />

      {condition === "구름많음" && (
        <div className="absolute inset-0 overflow-hidden">
          {CLOUD_PARTICLES.map((c, i) => (
            <span
              key={i}
              className="absolute rounded-[50%] blur-[24px] motion-reduce:animate-none"
              style={{
                top: `${c.top}%`,
                left: "-30%",
                width: `${c.width}px`,
                height: `${c.height}px`,
                opacity: c.opacity,
                backgroundColor: "#fff",
                animation: `weather-cloud-drift ${c.duration}s linear infinite`,
                animationDelay: `${c.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {condition === "비" && (
        <div className="absolute inset-0 overflow-hidden">
          {RAIN_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute top-0 w-[1.5px] -rotate-6 rounded-full bg-[rgba(200,225,255,0.55)] motion-reduce:animate-none"
              style={{
                left: `${p.left}%`,
                height: `${p.height}px`,
                animation: `weather-rain-fall ${p.duration}s linear infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {condition === "눈" && (
        <div className="absolute inset-0 overflow-hidden">
          {SNOW_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute top-0 rounded-full bg-white motion-reduce:animate-none"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: p.opacity,
                animation: `weather-snow-fall ${p.duration}s linear infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {condition === "폭염" && (
        <>
          <div
            className="absolute left-1/2 top-[34%] h-[320px] w-[320px] animate-[weather-heat-pulse_3.2s_ease-in-out_infinite] rounded-full blur-[2px] motion-reduce:animate-none sm:h-[640px] sm:w-[640px]"
            style={{
              backgroundImage: "radial-gradient(circle, #ff5a1f 0%, transparent 70%)",
              opacity: 0.6,
            }}
          />
          {/* 배경 전체가 아지랑이처럼 일렁이는 느낌 — 서로 다른 위치/주기로 떠다니는 흐릿한 열기
              덩어리 두 개를 겹친다. 한 덩어리(heat-pulse)만으로는 "제자리에서 커졌다 작아지는"
              느낌이라 "일렁인다"는 요청에는 이쪽이 더 맞는다. top 퍼센트는 이 엘리먼트의 포함
              블록(WeatherFx 전체 — 히어로+시간별+주간을 합친 높이)을 기준으로 계산되므로, 34%를
              넘겨 너무 아래로 잡으면(예전 시도) 총 콘텐츠가 화면보다 훨씬 긴 기기에서 접힌 아래로
              밀려나 안 보인다 — 기존 heat-pulse(top-34%)와 비슷한 범위로 맞췄다. mixBlendMode는
              원래 screen이었는데(같은 색 계열이라 없어도 탁해지지 않는다) 안드로이드 크롬
              실기기에서 blend-mode가 붙은 엘리먼트는 애니메이션 자체가 안 도는 문제가 있어
              뺐다(2026-08-14) — sun-glow/clouds도 같은 이유로 같이 뺐다. */}
          <div
            className="absolute left-[10%] top-[18%] h-[280px] w-[280px] animate-[weather-heat-shimmer_7s_ease-in-out_infinite] rounded-full blur-[8px] motion-reduce:animate-none"
            style={{ backgroundImage: "radial-gradient(circle, #ffd27a 0%, transparent 70%)" }}
          />
          <div
            className="absolute left-[78%] top-[42%] h-[240px] w-[240px] animate-[weather-heat-shimmer_9s_ease-in-out_infinite] rounded-full blur-[8px] motion-reduce:animate-none [animation-delay:-4s]"
            style={{ backgroundImage: "radial-gradient(circle, #ff8a3d 0%, transparent 70%)" }}
          />
        </>
      )}

      {condition === "밤" && (
        <div className="absolute inset-0">
          {STAR_POSITIONS.map((s, i) => (
            <span
              key={i}
              className="absolute h-[2px] w-[2px] rounded-full bg-white motion-reduce:animate-none"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                animation: `weather-star-twinkle ${s.duration}s ease-in-out infinite`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

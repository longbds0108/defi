import { useEffect, useRef } from 'react';

const GRAIN = '·:+*';
const COIN_GLYPHS = 'LUMORA01$€◆+*:';

type Coin = {
  x: number; // centre, fraction of width
  y: number; // centre, fraction of height
  r: number; // radius, fraction of min side
  spin: number; // radians per second
  phase: number;
  drift: number;
  depth: number; // parallax strength
  color: readonly [number, number, number];
};

const COINS: Coin[] = [
  { x: 0.8, y: 0.2, r: 0.16, spin: 0.55, phase: 0.4, drift: 0.9, depth: 1, color: [155, 93, 229] },
  { x: 0.92, y: 0.46, r: 0.1, spin: 0.8, phase: 2.2, drift: 1.3, depth: 0.7, color: [181, 125, 238] },
  { x: 0.78, y: 0.82, r: 0.14, spin: 0.45, phase: 1.1, drift: 0.7, depth: 0.9, color: [63, 145, 255] },
  { x: 0.1, y: 0.28, r: 0.08, spin: 0.7, phase: 3.1, drift: 1.1, depth: 0.5, color: [63, 145, 255] },
  { x: 0.16, y: 0.84, r: 0.12, spin: 0.5, phase: 4.2, drift: 0.8, depth: 0.8, color: [155, 93, 229] },
];

function hash(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/// Hero backdrop: a grain of monospace glyphs with a handful of spinning
/// "coins" drawn from characters. Pointer adds parallax. Static frame when the
/// user prefers reduced motion; the loop pauses while off-screen.
export function GlyphField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let cell = 12;
    let frame = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      cell = width < 640 ? 10 : 12;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reducedMotion) draw(start + 1600);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    function draw(now: number) {
      if (!context) return;
      const t = (now - start) / 1000;
      const reveal = Math.min(1, t / 1.4);
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      context.clearRect(0, 0, width, height);
      context.font = `${cell - 2}px "JetBrains Mono", monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      const minSide = Math.min(width, height);

      // Coin geometry for this frame: a spinning disc is an ellipse whose
      // horizontal radius follows |cos(angle)|.
      const coins = COINS.map((coin) => {
        const angle = coin.phase + t * coin.spin;
        const bob = Math.sin(t * 0.6 + coin.phase) * 10 * coin.drift;
        return {
          ...coin,
          cx: coin.x * width + pointer.x * 22 * coin.depth,
          cy: coin.y * height + bob + pointer.y * 16 * coin.depth,
          rx: Math.max(0.12, Math.abs(Math.cos(angle))) * coin.r * minSide,
          ry: coin.r * minSide,
          face: Math.cos(angle) >= 0,
        };
      });

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * cell + cell / 2;
          const y = row * cell + cell / 2;
          const noise = hash(col, row);

          let hit: (typeof coins)[number] | null = null;
          let radius = 2;
          for (const coin of coins) {
            const lx = (x - coin.cx) / coin.rx;
            const ly = (y - coin.cy) / coin.ry;
            const d = Math.sqrt(lx * lx + ly * ly);
            if (d <= 1 && d < radius) {
              hit = coin;
              radius = d;
            }
          }

          if (hit) {
            const rim = radius > 0.82;
            const shade = hit.face ? 1 : 0.55;
            const [r, g, b] = hit.color;
            const alpha = reveal * (rim ? 0.95 : 0.35 + (1 - radius) * 0.45) * shade;
            context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            const glyph = rim ? '◆' : COIN_GLYPHS[Math.floor(noise * COIN_GLYPHS.length)];
            context.fillText(glyph, x, y);
            continue;
          }

          // Sparse grain everywhere else, slowly twinkling.
          if (noise > 0.2) continue;
          const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + noise * 40);
          context.fillStyle = `rgba(233, 226, 245, ${reveal * (0.05 + twinkle * 0.09)})`;
          context.fillText(GRAIN[Math.floor(noise * 20) % GRAIN.length], x, y);
        }
      }
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (visible) draw(now);
    };

    const resizeObserver = new ResizeObserver(resize);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    resizeObserver.observe(canvas);
    visibility.observe(canvas);
    window.addEventListener('pointermove', onPointerMove);
    resize();
    if (!reducedMotion) frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="glyph-field" aria-hidden="true" />;
}

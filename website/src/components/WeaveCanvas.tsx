import { useEffect, useRef } from 'react';

/** Ambient warp-and-weft thread field behind the hero. */
export default function WeaveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;
    const host = cv.parentElement as HTMLElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gap = 26;
    let W = 0, H = 0, phase = 0, raf = 0;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = host.offsetWidth; H = host.offsetHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      cx.clearRect(0, 0, W, H);
      // warp: vertical threads on light paper, brass every 7th
      for (let x = 0; x <= W; x += gap) {
        const brass = Math.round(x / gap) % 7 === 0;
        cx.strokeStyle = brass ? 'rgba(192,130,30,0.11)' : 'rgba(46,53,102,0.05)';
        cx.lineWidth = 1;
        cx.beginPath();
        for (let y = 0; y <= H; y += 2) {
          const off = Math.sin(y * 0.03 + x * 0.05 + phase) * 1.1;
          y === 0 ? cx.moveTo(x + off, y) : cx.lineTo(x + off, y);
        }
        cx.stroke();
      }
      // weft: horizontal ink threads
      for (let y = 0; y <= H; y += gap) {
        cx.strokeStyle = 'rgba(27,30,51,0.035)';
        cx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const o = Math.sin(x * 0.03 + y * 0.05 - phase) * 1.1;
          x === 0 ? cx.moveTo(x, y + o) : cx.lineTo(x, y + o);
        }
        cx.stroke();
      }
    };

    const loop = () => { phase += 0.006; draw(); raf = requestAnimationFrame(loop); };

    resize();
    addEventListener('resize', resize);
    if (reduce) draw(); else loop();

    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="weave-canvas" aria-hidden="true" />;
}

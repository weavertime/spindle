import { useEffect, useRef } from 'react';

/** Three coloured collaborator threads, each carrying a travelling cursor. */
export default function ThreadsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !c.parentElement) return;
    const g = c.getContext('2d');
    if (!g) return;
    const host = c.parentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cols = ['#c0821e', '#c05a3a', '#2e9c82'];
    const d = Math.min(devicePixelRatio || 1, 2);
    let w = 0, h = 0, tp = 0, raf = 0;

    const resize = () => {
      w = host.offsetWidth; h = host.offsetHeight;
      c.width = w * d; c.height = h * d;
      c.style.width = '100%'; c.style.height = '100%';
      g.setTransform(d, 0, 0, d, 0, 0);
    };

    const draw = () => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = cols[i]; g.globalAlpha = 0.85; g.lineWidth = 1.6; g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = h / 2 + Math.sin(x * 0.018 + tp + i * 2.1) * (26 + i * 8) + (i - 1) * 30;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
        const hx = w * ((tp * 0.06 + i * 0.33) % 1);
        const hy = h / 2 + Math.sin(hx * 0.018 + tp + i * 2.1) * (26 + i * 8) + (i - 1) * 30;
        g.globalAlpha = 1; g.fillStyle = cols[i]; g.beginPath(); g.arc(hx, hy, 3.5, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    };

    const loop = () => { tp += 0.01; draw(); raf = requestAnimationFrame(loop); };

    resize();
    addEventListener('resize', resize);
    if (reduce) draw(); else loop();

    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} />;
}

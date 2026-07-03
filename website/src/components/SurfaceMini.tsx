import { useEffect, useRef } from 'react';

type Kind = 'sheet' | 'doc' | 'slide';

/** Small static canvas preview of each editing surface. */
export default function SurfaceMini({ kind }: { kind: Kind }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!c.parentElement || !g) return;
    const w = c.parentElement.offsetWidth || 300;
    const h = 104;
    const d = Math.min(devicePixelRatio || 1, 2);
    c.width = w * d; c.height = h * d;
    c.style.width = '100%'; c.style.height = h + 'px';
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w, h);

    if (kind === 'sheet') {
      g.strokeStyle = 'rgba(46,53,102,0.20)'; g.lineWidth = 1;
      for (let x = 14; x < w - 14; x += 34) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, h - 14); g.stroke(); }
      for (let y = 14; y < h - 14; y += 18) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
      g.fillStyle = 'rgba(224,168,62,0.24)'; g.fillRect(14, 32, 34, 18);
      g.strokeStyle = '#c0821e'; g.strokeRect(14.5, 32.5, 34, 18);
    } else if (kind === 'doc') {
      g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 40, 10, 80, h - 20);
      g.strokeStyle = 'rgba(46,53,102,0.18)'; g.strokeRect(w / 2 - 40 + 0.5, 10.5, 80, h - 20);
      g.fillStyle = 'rgba(27,30,51,0.72)'; g.fillRect(w / 2 - 30, 20, 60, 4);
      g.fillStyle = 'rgba(27,30,51,0.28)';
      for (let i = 0; i < 7; i++) g.fillRect(w / 2 - 30, 32 + i * 8, i % 3 === 2 ? 38 : 60, 3);
      g.fillStyle = '#c0821e'; g.fillRect(w / 2 - 30, 32 + 2 * 8, 24, 3);
    } else {
      g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 52, 16, 104, 72);
      g.strokeStyle = 'rgba(46,53,102,0.28)'; g.strokeRect(w / 2 - 52 + 0.5, 16.5, 104, 72);
      g.fillStyle = 'rgba(224,168,62,0.28)'; g.fillRect(w / 2 - 40, 26, 52, 30);
      g.fillStyle = 'rgba(27,30,51,0.30)';
      g.fillRect(w / 2 - 40, 62, 80, 4); g.fillRect(w / 2 - 40, 70, 60, 4);
      g.fillStyle = '#2e9c82'; g.beginPath(); g.arc(w / 2 + 30, 42, 10, 0, 7); g.fill();
    }
  }, [kind]);

  return <canvas ref={ref} className="mini" />;
}

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const REPO = 'https://github.com/weavertime/spindle';

/**
 * Full-page frame for the live demos: a thin header (home · switch surface ·
 * docs · GitHub) over a measured stage. The editors need explicit pixel
 * width/height, so the stage is measured and handed to `children` as a size.
 */
export default function DemoChrome({
  active,
  hint,
  children,
}: {
  active: 'sheets' | 'docs' | 'slides';
  hint: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  return (
    <div className="demo-shell">
      <header className="demo-top">
        <div className="demo-top-in">
          <Link className="brand" to="/" aria-label="Spindle home">
            <svg width="19" height="26" viewBox="0 0 22 30" fill="none" aria-hidden="true">
              <path d="M11 1 L11 29" stroke="#E0A83E" strokeWidth="1.4" />
              <path d="M4 6 L18 10 M18 6 L4 10" stroke="#c9bfa6" strokeWidth="1.2" />
              <path d="M3 15 L19 15" stroke="#E0A83E" strokeWidth="1" />
              <path d="M11 12.5 L16 15 L11 17.5 L6 15 Z" fill="#E0A83E" />
              <path d="M4 20 L18 24 M18 20 L4 24" stroke="#c9bfa6" strokeWidth="1.2" />
            </svg>
            Spindle <small>Live demo</small>
          </Link>
          <div className="demo-switch" role="tablist">
            <Link to="/demo/sheets" className={active === 'sheets' ? 'active' : ''}>
              Sheets
            </Link>
            <Link to="/demo/docs" className={active === 'docs' ? 'active' : ''}>
              Docs
            </Link>
            <Link to="/demo/slides" className={active === 'slides' ? 'active' : ''}>
              Slides
            </Link>
          </div>
          <div className="demo-top-right">
            <span className="demo-hint">{hint}</span>
            <Link to="/docs">Docs</Link>
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
          </div>
        </div>
      </header>
      <div className="demo-stage" ref={stageRef}>
        {size.width > 0 && size.height > 0 && children(size)}
      </div>
    </div>
  );
}

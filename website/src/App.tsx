import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import WeaveCanvas from './components/WeaveCanvas';
import SurfaceMini from './components/SurfaceMini';
import ThreadsCanvas from './components/ThreadsCanvas';
import ErrorBoundary from './components/ErrorBoundary';

// Code-split the real editor: the marketing shell paints immediately and the
// spreadsheet engine loads into its own chunk.
const LiveSheet = lazy(() => import('./components/LiveSheet'));

function SheetShell({ note }: { note: string }) {
  return (
    <div className="livesheet">
      <div className="livesheet-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="tt">yarn-inventory.sheet</span>
        <span className="live"><b />LIVE</span>
      </div>
      <div className="livesheet-body" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: '.8rem' }}>
        {note}
      </div>
    </div>
  );
}

const REPO = 'https://github.com/weavertime/spindle';
const NPM_ORG = 'https://www.npmjs.com/org/weavertime';
const INSTALL = 'npm i @weavertime/spindle-sheets-react';

const FEATURES = [
  { fi: 'Rendering', h: 'Painted to canvas', p: 'Cells and glyphs draw straight to a canvas with virtual scrolling. Tens of thousands of rows stay smooth at 60fps.' },
  { fi: 'Footprint', h: 'Sparse by design', p: 'A sparse cell store keeps memory and bundle size lean — you ship only the cells you actually use.' },
  { fi: 'Architecture', h: 'Portable cores', p: 'sheets-core and docs-core carry zero React. React is just the first loom; the engine goes anywhere.' },
  { fi: 'Collaboration', h: 'Real-time, offline-ready', p: 'CRDT editing over Yjs. Presence, remote cursors, and conflict-free offline merge come standard.' },
  { fi: 'AI-native', h: 'Pure-JSON model', p: 'Documents and workbooks are plain JSON. A bundled MCP server lets Claude generate and validate them directly.' },
  { fi: 'License', h: 'Forever free', p: 'MIT-licensed. No tiers, no seats, no asterisks. The entire suite is yours to fork and reshape.' },
];

const SURFACES = [
  { kind: 'sheet' as const, h: 'Sheets', pkg: '@weavertime/spindle-sheets-react', soon: false, p: 'Formulas, filters, cell formatting, frozen panes, and a canvas grid that scrolls like native.' },
  { kind: 'doc' as const, h: 'Docs', pkg: '@weavertime/spindle-docs-react', soon: false, p: 'Paginated, print-true documents on a ProseMirror engine with a line-level “True Layout” paginator.' },
  { kind: 'slide' as const, h: 'Slides', pkg: '@weavertime/spindle-docs-react', soon: true, p: 'Presentation editing on the same document core — one data model, three surfaces. Planned next, on the same engine.' },
];

const PACKAGES = [
  ['spindle-shared', 'Framework-agnostic utilities — events, collaboration primitives'],
  ['spindle-sheets-core', 'Spreadsheet engine · sparse store · formulas · zero React'],
  ['spindle-sheets-react', 'React canvas grid, formula bar, toolbar & dialogs'],
  ['spindle-docs-core', 'Document engine · True Layout · zero React · slides coming soon'],
  ['spindle-docs-react', 'React document & presentation editor components'],
  ['spindle-transport-websocket', 'WebSocket-backed collaboration provider'],
];

export default function App() {
  return (
    <>
      <TopBar />
      <Hero />
      <Install />
      <Features />
      <Surfaces />
      <Packages />
      <Collab />
      <Footer />
    </>
  );
}

function TopBar() {
  return (
    <header className="top"><div className="wrap">
      <a className="brand" href="#top" aria-label="Spindle home">
        <svg width="22" height="30" viewBox="0 0 22 30" fill="none" aria-hidden="true">
          <path d="M11 1 L11 29" stroke="#E0A83E" strokeWidth="1.4" />
          <path d="M4 6 L18 10 M18 6 L4 10" stroke="#ECE6D6" strokeWidth="1.2" opacity=".85" />
          <path d="M3 15 L19 15" stroke="#E0A83E" strokeWidth="1" />
          <path d="M11 12.5 L16 15 L11 17.5 L6 15 Z" fill="#E0A83E" />
          <path d="M4 20 L18 24 M18 20 L4 24" stroke="#ECE6D6" strokeWidth="1.2" opacity=".85" />
        </svg>
        Spindle <small>by Weavertime</small>
      </a>
      <nav className="nav">
        <a href="#install">Install</a>
        <a href="#features">Features</a>
        <a href="#packages">Packages</a>
        <Link to="/docs">Docs</Link>
        <a className="ghstar" href={REPO}>★ Star</a>
      </nav>
    </div></header>
  );
}

function Hero() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(INSTALL).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <section className="hero" id="top">
      <WeaveCanvas />
      <div className="wrap">
        <div>
          <div className="eyebrow">Open source · MIT · React</div>
          <h1>Spreadsheets, documents &amp; slides, <em>woven into</em> your app.</h1>
          <p className="lede">Spindle is the full editing experience of a commercial office suite — as forever-free React libraries you own outright.</p>
          <div className="cta">
            <button className="install" onClick={copy} title="Copy to clipboard">
              <span className="dollar">$</span>
              <span>{INSTALL}</span>
              <span className="cp" style={copied ? { color: 'var(--teal)' } : undefined}>{copied ? 'COPIED ✓' : 'COPY'}</span>
            </button>
            <Link className="btn" to="/docs">Read the docs →</Link>
          </div>
          <div className="metaline">
            <span><i />Canvas rendering</span>
            <span><i />Sparse storage</span>
            <span><i />CRDT collaboration</span>
            <span><i />AI-native JSON</span>
          </div>
        </div>
        <div>
          <ErrorBoundary fallback={<SheetShell note="Editor loads in the app →" />}>
            <Suspense fallback={<SheetShell note="loading editor…" />}>
              <LiveSheet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </section>
  );
}

function Install() {
  return (
    <section className="sec" id="install"><div className="wrap">
      <SecLabel n="01 — QUICK START" />
      <div className="quick">
        <div>
          <h2>Mount an editor in three lines.</h2>
          <p className="intro">Install a package, wrap your data in a provider, drop in the canvas. The React layer is a thin skin over a framework-agnostic core — so the same engine can move to any loom later.</p>
        </div>
        <div className="code">
          <div className="cap"><i /><i /><i /></div>
          <pre>
<span className="c1"># the spreadsheet library</span>{'\n'}
<span className="k">npm</span> i <span className="t">@weavertime/spindle-sheets-react</span>{'\n\n'}
<span className="k">import</span> {'{ WorkbookProvider, WorkbookCanvas }'} <span className="k">from</span> <span className="s">'@weavertime/spindle-sheets-react'</span>;{'\n\n'}
<span className="k">export function</span> <span className="t">Editor</span>({'{ data }'}) {'{'}{'\n'}
{'  '}<span className="k">return</span> ({'\n'}
{'    '}&lt;<span className="t">WorkbookProvider</span> initial={'{data}'}&gt;{'\n'}
{'      '}&lt;<span className="t">WorkbookCanvas</span> /&gt;{'\n'}
{'    '}&lt;/<span className="t">WorkbookProvider</span>&gt;{'\n'}
{'  '});{'\n'}
{'}'}
          </pre>
        </div>
      </div>
    </div></section>
  );
}

function Features() {
  return (
    <section className="sec" id="features"><div className="wrap">
      <SecLabel n="02 — THE WEAVE" />
      <h2>Built like a loom: precise, fast, and yours to re-thread.</h2>
      <p className="intro" style={{ marginBottom: 38 }}>Every design goal points the same way — performance, portability, and complete control over the tools.</p>
      <div className="weavegrid">
        {FEATURES.map((f) => (
          <div className="cell-f" key={f.h}>
            <div className="fi">{f.fi}</div>
            <h3>{f.h}</h3>
            <p>{f.p}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}

function Surfaces() {
  return (
    <section className="sec"><div className="wrap">
      <SecLabel n="03 — THREE SURFACES, ONE LOOM" />
      <div className="surfaces">
        {SURFACES.map((s) => (
          <div className={`surf${s.soon ? ' soon' : ''}`} key={s.h}>
            <SurfaceMini kind={s.kind} />
            <div className="surf-head">
              <h3>{s.h}</h3>
              {s.soon && <span className="soon-badge">Coming soon</span>}
            </div>
            <div className="pkg">{s.pkg}</div>
            <p>{s.p}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}

function Packages() {
  return (
    <section className="sec" id="packages"><div className="wrap">
      <SecLabel n="04 — EVERY THREAD" />
      <h2 style={{ marginBottom: 30 }}>Six packages, one scope.</h2>
      <div className="tblwrap"><table className="tbl">
        <thead><tr><th>Package</th><th>Role</th><th style={{ textAlign: 'right' }}>Version</th></tr></thead>
        <tbody>
          {PACKAGES.map(([name, role]) => (
            <tr key={name}>
              <td className="p">@weavertime/<b>{name}</b></td>
              <td className="d">{role}</td>
              <td className="v">0.2.0</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div></section>
  );
}

function Collab() {
  return (
    <section className="sec"><div className="wrap">
      <SecLabel n="05 — MANY HANDS, ONE CLOTH" />
      <div className="collab">
        <div>
          <h2>Everyone weaves the same thread.</h2>
          <p className="intro">Collaboration is built into the core, not bolted on. Edits merge conflict-free over a CRDT; presence and remote cursors travel with them. Bring the bundled WebSocket provider or wire your own transport.</p>
          <div className="metaline" style={{ marginTop: 26 }}>
            <span><i />Yjs CRDT</span><span><i />Live presence</span><span><i />Offline merge</span><span><i />Pluggable transport</span>
          </div>
        </div>
        <div className="threads"><ThreadsCanvas /></div>
      </div>
    </div></section>
  );
}

function Footer() {
  return (
    <footer id="docs"><div className="wrap">
      <div className="foot">
        <div className="about">
          <div className="fbrand">Spindle</div>
          The open-source editing layer for the modern web — spreadsheets, documents, and slides as React libraries.
          Part of the <strong style={{ color: 'var(--linen)' }}>Weavertime</strong> family, alongside <strong style={{ color: 'var(--linen)' }}>Weaversuite</strong>, the encrypted drive it was spun for.
        </div>
        <div>
          <h4>Project</h4>
          <a href={REPO}>GitHub repository</a>
          <a href={NPM_ORG}>npm · @weavertime</a>
          <a href="#packages">Packages</a>
          <a href="#features">Features</a>
        </div>
        <div>
          <h4>Learn</h4>
          <a href="#install">Quick start</a>
          <Link to="/docs">Documentation</Link>
          <Link to="/docs/collaboration">Collaboration guide</Link>
          <Link to="/docs/comments">Comments</Link>
        </div>
      </div>
      <div className="legal">
        <span>MIT © 2026 Weavertime</span>
        <span>spindle.weavertime.com</span>
      </div>
    </div></footer>
  );
}

function SecLabel({ n }: { n: string }) {
  return <div className="sec-label"><span className="n">{n}</span><span className="ln" /></div>;
}

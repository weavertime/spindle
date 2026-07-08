// Shared floating-toolbar UI — matches the Spindle docs/sheets toolbar: a
// translucent, blurred, rounded pill with indigo-accent buttons, gradient
// dividers, and hover tooltips. Used by the slides Toolbar and its sub-bars so
// they read as one cohesive floating control.

import React, { useEffect, useState } from 'react';

const FONT = '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif';

export const TB = {
  /** The gradient strip the pill floats on. */
  strip: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    gap: 8,
    padding: '8px 12px',
    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
  } as React.CSSProperties,

  /** The floating pill container. */
  pill: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 2,
    padding: '6px 10px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 16,
    boxShadow:
      '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.08), 0 20px 25px -5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.04)',
    fontFamily: FONT,
    maxWidth: 'fit-content',
  } as React.CSSProperties,

  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  buttonHover: { background: 'rgba(99,102,241,0.08)', color: '#6366f1' } as React.CSSProperties,
  buttonActive: { background: 'rgba(99,102,241,0.15)', color: '#6366f1', boxShadow: 'inset 0 1px 2px rgba(99,102,241,0.15)' } as React.CSSProperties,
  buttonDisabled: { opacity: 0.4, cursor: 'default', pointerEvents: 'none' as const } as React.CSSProperties,

  divider: {
    width: 1,
    height: 22,
    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
    margin: '0 6px',
    flexShrink: 0,
  } as React.CSSProperties,

  /** Text dropdown trigger (e.g. Slide ▾, Theme ▾). */
  dropdownButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 30,
    padding: '0 8px 0 10px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: FONT,
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties,

  tooltip: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: '50%',
    padding: '5px 9px',
    background: '#1e293b',
    color: '#fff',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 6,
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    opacity: 0,
    zIndex: 10001,
  } as React.CSSProperties,
};

/** Inject the tooltip hover CSS once (delayed reveal, matches docs). */
function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('spindle-toolbar-ui')) return;
  const style = document.createElement('style');
  style.id = 'spindle-toolbar-ui';
  style.textContent = `
    .sp-tb-btn .sp-tb-tip { transform: translateX(-50%) translateY(4px); transition: opacity .2s ease .4s, transform .2s ease .4s; }
    .sp-tb-btn:hover .sp-tb-tip { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; }
  `;
  document.head.appendChild(style);
}

export function ToolbarButton({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const [hover, setHover] = useState(false);
  useEffect(injectStyles, []);
  return (
    <button
      className="sp-tb-btn"
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        ...TB.button,
        ...(hover && !active && !disabled ? TB.buttonHover : {}),
        ...(active ? TB.buttonActive : {}),
        ...(disabled ? TB.buttonDisabled : {}),
      }}
    >
      {children}
      <span className="sp-tb-tip" style={TB.tooltip}>{title}</span>
    </button>
  );
}

export function ToolbarDivider(): React.ReactElement {
  return <span style={TB.divider} />;
}

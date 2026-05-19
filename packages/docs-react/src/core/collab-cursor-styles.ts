// Inject the styles y-prosemirror's default cursor / selection decorations
// need to display correctly. The cursor builder sets per-user colors inline,
// so this stylesheet only handles layout (positioning of the caret bar and
// the floating name label).
//
// ensureCollabCursorStyles is idempotent — call it from any editor mount
// path that may run with collab attached.

const STYLE_ID = 'pagent-collab-cursor-styles';

const CSS = `
/* y-prosemirror's default decoration cursor (used by ProseMirrorEditor). */
.ProseMirror-yjs-cursor {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid currentColor;
  border-right: 1px solid currentColor;
  word-break: normal;
  pointer-events: none;
}
.ProseMirror-yjs-cursor > div {
  position: absolute;
  top: -1.05em;
  left: -1px;
  font-size: 12px;
  background-color: currentColor;
  color: white;
  padding: 0 4px;
  border-radius: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  user-select: none;
}

/* TrueLayoutEditor's painted-page overlay equivalents (RemoteCursorOverlay). */
.pagent-remote-caret {
  position: absolute;
  pointer-events: none;
  border-left: 2px solid currentColor;
  z-index: 10;
  top: 0;
  left: 0;
  will-change: transform;
}
.pagent-remote-caret-label {
  position: absolute;
  top: -1.35em;
  left: -2px;
  font-size: 11px;
  background-color: currentColor;
  color: white;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 500;
  line-height: 1.3;
}
.pagent-remote-selection-rect {
  position: absolute;
  pointer-events: none;
  z-index: 9;
  opacity: 0.25;
  top: 0;
  left: 0;
  will-change: transform;
}
`;

export function ensureCollabCursorStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

// SlidesEditor — the root editor layout: toolbar, filmstrip, and the
// interactive stage. Owns keyboard shortcuts (attached to a focused wrapper,
// not window) and the right-click context menu.

import React, { useEffect, useRef, useState } from 'react';
import { Play, MessageSquare } from 'lucide-react';
import { useDeck, useKeyboardShortcuts, useCommentsOpen } from '../hooks';
import { usePasteImport } from '../hooks/usePasteImport';
import { useDeckContext } from '../context/DeckContext';
import { Toolbar } from './Toolbar';
import { Filmstrip } from './Filmstrip';
import { SlideStage } from './SlideStage';
import { NotesPanel } from './NotesPanel';
import { ContextMenu } from './ContextMenu';
import { SlideContextMenu } from './SlideContextMenu';
import { TableCellMenu } from './TableCellMenu';
import { PresentMode } from './PresentMode';
import { CommentsPanel } from './CommentsPanel';

type Zoom = number | 'fit';
const ZOOM_PRESETS: Array<{ label: string; zoom: Zoom }> = [
  { label: 'Fit', zoom: 'fit' },
  { label: '50%', zoom: 0.5 },
  { label: '100%', zoom: 1 },
  { label: '200%', zoom: 2 },
];

export interface SlidesEditorProps {
  style?: React.CSSProperties;
  /** Read-only viewer (no toolbar, gestures, or shortcuts). */
  readOnly?: boolean;
  /**
   * Extra buttons for the header's action group (rendered before Present).
   * App-level concerns like PDF/PNG export live here — export is intentionally
   * kept out of this package; the host wires it up from the public render API.
   */
  headerActions?: React.ReactNode;
}

export function SlidesEditor({ style, readOnly = false, headerActions }: SlidesEditorProps): React.ReactElement {
  const deck = useDeck();
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [menu, setMenu] = useState<
    | { x: number; y: number; kind: 'element' }
    | { x: number; y: number; kind: 'slide'; slideId: string }
    | { x: number; y: number; kind: 'tableCell'; tableId: string; row: number; col: number }
    | null
  >(null);
  const [presenting, setPresenting] = useState(false);
  const { ui, tableSel } = useDeckContext();
  const showComments = useCommentsOpen();
  const { onKeyDown } = useKeyboardShortcuts();
  const { onPaste } = usePasteImport();
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the editor so keyboard shortcuts work without an explicit click.
  useEffect(() => {
    if (!readOnly) rootRef.current?.focus();
  }, [readOnly]);

  return (
    <div
      ref={rootRef}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={readOnly ? undefined : onKeyDown}
      onPaste={readOnly ? undefined : onPaste}
      onContextMenu={(e) => {
        if (readOnly) return;
        const target = e.target as HTMLElement;
        // A slide thumbnail in the filmstrip → slide menu.
        const thumb = target.closest('[data-slide-thumb]');
        if (thumb) {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, kind: 'slide', slideId: thumb.getAttribute('data-slide-thumb')! });
          return;
        }
        if (target.closest('[data-slide-stage]')) {
          e.preventDefault();
          // A table cell, or a row/column header gutter, → the table menu
          // (insert/delete rows·cols, fill). Otherwise the generic element menu.
          // Elsewhere (toolbar/header/notes) → native.
          const cellEl = target.closest('[data-cell]');
          const elEl = target.closest('[data-element-id]');
          const cellTableId = elEl?.getAttribute('data-element-id');
          const rowSelEl = target.closest('[data-row-select]');
          const colSelEl = target.closest('[data-col-select]');
          const gripEl = target.closest('[data-table-move]');
          // Gutters live in an overlay (no data-cell ancestor); they only show
          // for the single selected table, so read it from the selection.
          const gutterTableId = deck.getSelection().elementIds[0];
          const gutterTable = gutterTableId ? deck.getElement(gutterTableId) : undefined;

          if (cellEl && cellTableId && deck.getElement(cellTableId)?.type === 'table') {
            const [r, c] = cellEl.getAttribute('data-cell')!.split(',').map(Number);
            setMenu({ x: e.clientX, y: e.clientY, kind: 'tableCell', tableId: cellTableId, row: r, col: c });
          } else if ((rowSelEl || colSelEl || gripEl) && gutterTable?.type === 'table') {
            // Select the whole row/column first so the menu's fill/delete target
            // it; the corner grip targets the top-left cell.
            let r = 0, c = 0;
            if (rowSelEl) { r = Number(rowSelEl.getAttribute('data-row-select')); tableSel.set(gutterTableId!, [r, 0], [r, gutterTable.cols - 1]); }
            else if (colSelEl) { c = Number(colSelEl.getAttribute('data-col-select')); tableSel.set(gutterTableId!, [0, c], [gutterTable.rows - 1, c]); }
            setMenu({ x: e.clientX, y: e.clientY, kind: 'tableCell', tableId: gutterTableId!, row: r, col: c });
          } else {
            setMenu({ x: e.clientX, y: e.clientY, kind: 'element' });
          }
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#1f2933',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid #e2e4e8', background: '#fff' }}>
        <strong style={{ fontSize: 15 }}>{deck.getTitle()}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!readOnly && (
            <>
              {headerActions}
              <button
                onClick={() => setPresenting(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: '#2d7ff9', color: '#fff', borderRadius: 5, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
              >
                <Play size={14} /> Present
              </button>
              <button
                onClick={() => ui.toggleComments()}
                title="Comments"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d5d9e0', background: showComments ? '#eef4ff' : '#fff', color: '#3e4c59', borderRadius: 5, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
              >
                <MessageSquare size={14} />
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {zoom !== 'fit' && !ZOOM_PRESETS.some((p) => p.zoom === zoom) && (
            <span style={{ fontSize: 12, color: '#8a93a2', minWidth: 40, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
          )}
          {ZOOM_PRESETS.map((p) => {
            const active = p.zoom === zoom;
            return (
              <button
                key={p.label}
                onClick={() => setZoom(p.zoom)}
                style={{ border: '1px solid #d5d9e0', background: active ? '#2d7ff9' : '#fff', color: active ? '#fff' : '#3e4c59', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </header>
      {!readOnly && <Toolbar />}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, gap: 12, padding: '4px 12px 12px', background: 'linear-gradient(180deg, #f1f5f9 0%, #eaeef4 100%)' }}>
        <Filmstrip />
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, gap: 12 }}>
          <SlideStage zoom={zoom === 'fit' ? undefined : zoom} interactive={!readOnly} onZoomChange={setZoom} />
          {!readOnly && <NotesPanel />}
        </div>
        {!readOnly && showComments && <CommentsPanel onClose={() => ui.setCommentsOpen(false)} />}
      </div>
      {menu?.kind === 'element' && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {menu?.kind === 'slide' && <SlideContextMenu slideId={menu.slideId} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {menu?.kind === 'tableCell' && <TableCellMenu tableId={menu.tableId} row={menu.row} col={menu.col} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {presenting && <PresentMode onExit={() => setPresenting(false)} />}
    </div>
  );
}

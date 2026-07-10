// TableFormatBar — inline table controls in the main Toolbar row when a single
// table is selected: append a row / column and set the grid border color +
// width. Precise per-cell inserts/deletes and fills live in the cell right-click
// menu; column/row resize is a drag on the cell boundaries.

import React, { useSyncExternalStore } from 'react';
import { Rows3, Columns3, PaintBucket } from 'lucide-react';
import { resolveColor, type Color, type Stroke, type TableElement } from '@weavertime/spindle-slides-core';
import { useDeck, useTheme, useSelection, useElement } from '../hooks';
import { useDeckContext } from '../context/DeckContext';
import { cellsInSelection } from '../interactions/table-selection-store';
import { ToolbarButton, ToolbarDivider } from './toolbarUI';

const field: React.CSSProperties = {
  height: 30, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
  background: 'rgba(255,255,255,0.8)', color: '#334155', padding: '0 6px',
  fontSize: 13, fontFamily: '"Inter", sans-serif', cursor: 'pointer',
};
const WIDTHS = [1, 2, 3, 4];

function colorToHex(color: Color, theme: ReturnType<typeof useTheme>): string {
  const s = resolveColor(color, theme);
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#888888';
}

export function TableFormatBar(): React.ReactElement | null {
  const deck = useDeck();
  const theme = useTheme();
  const selection = useSelection();
  const { tableSel } = useDeckContext();
  const sel = useSyncExternalStore(tableSel.subscribe, tableSel.getState);
  const id = selection.elementIds.length === 1 ? selection.elementIds[0] : null;
  const el = useElement(id ?? '') as TableElement | undefined;
  if (!id || !el || el.type !== 'table') return null;

  const border = el.border ?? { color: { kind: 'theme', slot: 'dk2' } as Color, width: 1 };
  const setBorder = (patch: Partial<Stroke>) => deck.updateElement(id, { border: { ...border, ...patch } });

  // Fill applies to the current cell-range selection (a row / column / block);
  // without one there's nothing to fill, so the control is disabled.
  const cells = sel && sel.tableId === id ? cellsInSelection(sel) : [];
  const canFill = cells.length > 0;
  const firstCell = canFill ? el.cells[cells[0][0]]?.[cells[0][1]] : undefined;
  const fillHex = firstCell?.fill?.kind === 'solid' && /^#[0-9a-fA-F]{6}$/.test(resolveColor(firstCell.fill.color, theme))
    ? resolveColor(firstCell.fill.color, theme)
    : '#ffffff';
  const setFill = (fill: TableElement['cells'][number][number]['fill']) => deck.updateTableCells(id, cells, { fill });

  return (
    <>
      <ToolbarDivider />
      <ToolbarButton title="Add row" onClick={() => deck.insertTableRow(id, el.rows)}>
        <Rows3 size={15} />
      </ToolbarButton>
      <ToolbarButton title="Add column" onClick={() => deck.insertTableColumn(id, el.cols)}>
        <Columns3 size={15} />
      </ToolbarButton>
      <ToolbarDivider />
      <PaintBucket size={14} style={{ color: canFill ? '#64748b' : '#cbd5e1' }} aria-hidden />
      <input
        type="color"
        title={canFill ? 'Cell fill (selected cells)' : 'Select cells to fill'}
        disabled={!canFill}
        value={fillHex}
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => setFill({ kind: 'solid', color: { kind: 'rgb', hex: e.target.value } })}
        style={{ ...field, width: 34, padding: 3, opacity: canFill ? 1 : 0.4, cursor: canFill ? 'pointer' : 'default' }}
      />
      <ToolbarButton title="Clear fill" disabled={!canFill} onClick={() => setFill(undefined)}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>⦸</span>
      </ToolbarButton>
      <ToolbarDivider />
      <input
        type="color"
        title="Grid line color"
        value={colorToHex(border.color, theme)}
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => setBorder({ color: { kind: 'rgb', hex: e.target.value } })}
        style={{ ...field, width: 34, padding: 3 }}
      />
      <select
        title="Grid line width"
        value={String(border.width)}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setBorder({ width: Number(e.target.value) })}
        style={field}
      >
        {WIDTHS.map((w) => (
          <option key={w} value={w}>{w}px</option>
        ))}
      </select>
    </>
  );
}

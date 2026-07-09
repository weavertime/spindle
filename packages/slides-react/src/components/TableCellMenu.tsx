// TableCellMenu — the right-click menu for a table cell: insert/delete rows and
// columns relative to this cell, and set/clear the cell's fill. Operates on the
// exact [row, col] that was right-clicked.

import React from 'react';
import { resolveColor, type Color, type TableElement } from '@weavertime/spindle-slides-core';
import { useDeck, useTheme, useElement } from '../hooks';
import { Menu, type MenuItem } from './Menu';

export interface TableCellMenuProps {
  tableId: string;
  row: number;
  col: number;
  x: number;
  y: number;
  onClose: () => void;
}

function fillHex(color: Color | undefined, theme: ReturnType<typeof useTheme>): string {
  if (!color) return '#ffffff';
  const s = resolveColor(color, theme);
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#ffffff';
}

export function TableCellMenu({ tableId, row, col, x, y, onClose }: TableCellMenuProps): React.ReactElement | null {
  const deck = useDeck();
  const theme = useTheme();
  const el = useElement(tableId) as TableElement | undefined;
  if (!el || el.type !== 'table') return null;
  const cell = el.cells[row]?.[col];

  const items: Array<MenuItem | 'sep'> = [
    { label: 'Insert row above', run: () => deck.insertTableRow(tableId, row) },
    { label: 'Insert row below', run: () => deck.insertTableRow(tableId, row + 1) },
    { label: 'Insert column left', run: () => deck.insertTableColumn(tableId, col) },
    { label: 'Insert column right', run: () => deck.insertTableColumn(tableId, col + 1) },
    'sep',
    { label: 'Delete row', run: () => deck.removeTableRow(tableId, row), disabled: el.rows <= 1 },
    { label: 'Delete column', run: () => deck.removeTableColumn(tableId, col), disabled: el.cols <= 1 },
  ];

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: 13, color: '#2b3440' }}>
      <span>Cell fill</span>
      <input
        type="color"
        title="Cell fill"
        value={fillHex(cell?.fill?.kind === 'solid' ? cell.fill.color : undefined, theme)}
        onChange={(e) => deck.updateTableCell(tableId, row, col, { fill: { kind: 'solid', color: { kind: 'rgb', hex: e.target.value } } })}
        style={{ width: 30, height: 26, border: '1px solid #d5d9e0', borderRadius: 6, padding: 2, cursor: 'pointer' }}
      />
      <button
        onPointerDown={(e) => { e.stopPropagation(); deck.updateTableCell(tableId, row, col, { fill: undefined }); onClose(); }}
        style={{ marginLeft: 'auto', border: '1px solid #d5d9e0', background: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 12, color: '#3e4c59', cursor: 'pointer' }}
      >
        Clear
      </button>
    </div>
  );

  return <Menu x={x} y={y} items={items} onClose={onClose} footer={footer} />;
}

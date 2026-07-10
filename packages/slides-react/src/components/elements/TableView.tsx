// TableView — renders a table element as a fixed-layout HTML <table>. Column
// widths and row heights come from the element's fractions; each cell shows its
// rich text via StaticRichText, or, on the interactive stage, a live editor for
// the cell being edited. Grid lines use the element's border stroke.

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { resolveColor, resolveFill, type Color, type TableElement, type ThemeData } from '@weavertime/spindle-slides-core';
import { useDeckContext } from '../../context/DeckContext';
import { inSelection } from '../../interactions/table-selection-store';
import { StaticRichText } from './StaticRichText';
import { RichTextEditor } from '../RichTextEditor';

// Translucent tint painted over a selected cell (sits above its own fill, below
// the text) via a huge inset shadow the cell's overflow:hidden clips flat.
const SELECT_TINT = 'inset 0 0 0 9999px rgba(45,127,249,0.20)';

// Cell text metrics. StaticRichText inherits font-size from the <td>, so we set
// it explicitly to the SAME values the live editor uses — otherwise text would
// resize/shift the moment you double-click into a cell.
const CELL_FONT = 16;
const CELL_PAD = 6;

export function TableView({ el, theme, interactive = false }: { el: TableElement; theme: ThemeData; interactive?: boolean }): React.ReactElement {
  const { deck, editing, tableSel } = useDeckContext();
  const editState = useSyncExternalStore(editing.subscribe, editing.getState);
  const sel = useSyncExternalStore(tableSel.subscribe, tableSel.getState);
  const editingCell = interactive && editState.id === el.id ? editState.cell : null;
  const cellSel = interactive && sel && sel.tableId === el.id ? sel : null;

  // Cell text wraps, so a table can render taller than its frame height. Grow
  // the element to fit its content (no undo entry) so the frame — and the
  // selection box, gutters, and resize handles that read it — cover the whole
  // table. Only the full-size interactive render drives this (not thumbnails).
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!interactive || typeof ResizeObserver === 'undefined') return;
    const node = tableRef.current;
    if (!node) return;
    const sync = () => deck.autoSizeElementHeight(el.id, node.offsetHeight);
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    sync();
    return () => ro.disconnect();
  }, [deck, el.id, interactive]);

  const border = el.border
    ? `${Math.max(1, el.border.width)}px solid ${resolveColor(el.border.color, theme)}`
    : `1px solid ${resolveColor({ kind: 'theme', slot: 'dk2' } as Color, theme)}`;

  return (
    <table
      ref={tableRef}
      data-table-id={el.id}
      style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'inherit' }}
    >
      <colgroup>
        {el.colFractions.map((f, i) => (
          <col key={i} style={{ width: `${f * 100}%` }} />
        ))}
      </colgroup>
      <tbody>
        {el.cells.map((row, r) => (
          <tr key={r} style={{ height: `${(el.rowFractions[r] ?? 1 / el.rows) * 100}%` }}>
            {row.map((cell, c) => {
              const bg = cell.fill ? resolveFill(cell.fill, theme) : null;
              const isEditing = !!editingCell && editingCell[0] === r && editingCell[1] === c;
              const isSelected = !!cellSel && !isEditing && inSelection(cellSel, r, c);
              // Fill in cell defaults so the static <td> and the live editor
              // agree on padding, size, and vertical alignment (no jump on edit).
              const cellStyle = {
                padding: cell.bodyStyle?.padding ?? CELL_PAD,
                fontSize: cell.bodyStyle?.fontSize ?? CELL_FONT,
                vAlign: cell.bodyStyle?.vAlign ?? 'top',
                ...cell.bodyStyle,
              };
              return (
                <td
                  key={c}
                  data-cell={`${r},${c}`}
                  style={{
                    border,
                    verticalAlign: cellStyle.vAlign,
                    fontSize: cellStyle.fontSize,
                    background: bg ?? undefined,
                    boxShadow: isSelected ? SELECT_TINT : undefined,
                    padding: isEditing ? 0 : cellStyle.padding,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  {isEditing ? (
                    <RichTextEditor elementId={el.id} theme={theme} cell={[r, c]} bodyStyle={cellStyle} />
                  ) : (
                    <StaticRichText doc={cell.richText} theme={theme} />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

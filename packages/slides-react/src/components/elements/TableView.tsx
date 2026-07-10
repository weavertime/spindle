// TableView — renders a table element as a fixed-layout HTML <table>. Column
// widths and row heights come from the element's fractions; each cell shows its
// rich text via StaticRichText, or, on the interactive stage, a live editor for
// the cell being edited. Grid lines use the element's border stroke.

import React, { useSyncExternalStore } from 'react';
import { resolveColor, resolveFill, type Color, type TableElement, type ThemeData } from '@weavertime/spindle-slides-core';
import { useDeckContext } from '../../context/DeckContext';
import { inSelection } from '../../interactions/table-selection-store';
import { StaticRichText } from './StaticRichText';
import { RichTextEditor } from '../RichTextEditor';

// Translucent tint painted over a selected cell (sits above its own fill, below
// the text) via a huge inset shadow the cell's overflow:hidden clips flat.
const SELECT_TINT = 'inset 0 0 0 9999px rgba(45,127,249,0.20)';

export function TableView({ el, theme, interactive = false }: { el: TableElement; theme: ThemeData; interactive?: boolean }): React.ReactElement {
  const { editing, tableSel } = useDeckContext();
  const editState = useSyncExternalStore(editing.subscribe, editing.getState);
  const sel = useSyncExternalStore(tableSel.subscribe, tableSel.getState);
  const editingCell = interactive && editState.id === el.id ? editState.cell : null;
  const cellSel = interactive && sel && sel.tableId === el.id ? sel : null;

  const border = el.border
    ? `${Math.max(1, el.border.width)}px solid ${resolveColor(el.border.color, theme)}`
    : `1px solid ${resolveColor({ kind: 'theme', slot: 'dk2' } as Color, theme)}`;

  return (
    <table
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
              return (
                <td
                  key={c}
                  data-cell={`${r},${c}`}
                  style={{
                    border,
                    verticalAlign: cell.bodyStyle?.vAlign ?? 'top',
                    background: bg ?? undefined,
                    boxShadow: isSelected ? SELECT_TINT : undefined,
                    padding: isEditing ? 0 : cell.bodyStyle?.padding ?? 6,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  {isEditing ? (
                    <RichTextEditor elementId={el.id} theme={theme} cell={[r, c]} bodyStyle={cell.bodyStyle} />
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

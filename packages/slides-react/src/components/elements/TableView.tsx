// TableView — renders a table element as a fixed-layout HTML <table>. Column
// widths and row heights come from the element's fractions; each cell shows its
// rich text via StaticRichText (the interactive editor mounts per-cell in a
// follow-up). Grid lines use the element's border stroke.

import React from 'react';
import { resolveColor, resolveFill, type Color, type TableElement, type ThemeData } from '@weavertime/spindle-slides-core';
import { StaticRichText } from './StaticRichText';

export function TableView({ el, theme }: { el: TableElement; theme: ThemeData; interactive?: boolean }): React.ReactElement {
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
              return (
                <td
                  key={c}
                  data-cell={`${r},${c}`}
                  style={{
                    border,
                    verticalAlign: cell.bodyStyle?.vAlign ?? 'top',
                    background: bg ?? undefined,
                    padding: cell.bodyStyle?.padding ?? 6,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  <StaticRichText doc={cell.richText} theme={theme} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

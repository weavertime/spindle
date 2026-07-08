// LineFormatBar — inline arrowhead controls, rendered *inside* the main Toolbar
// row (like TextFormatBar) so selecting a line doesn't shift the layout. Sets a
// selected line's start/end arrowheads to one of: no arrow, arrow on one side,
// or arrows on both ends. Renders nothing unless a single line is selected.

import React from 'react';
import { Minus, MoveLeft, MoveRight, MoveHorizontal } from 'lucide-react';
import type { ArrowHead, LineElement } from '@weavertime/spindle-slides-core';
import { useDeck, useSelection, useElement } from '../hooks';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, border: '1px solid #d5d9e0', borderRadius: 5,
  background: '#fff', color: '#3e4c59', cursor: 'pointer',
};
const active: React.CSSProperties = { background: '#e8f0fe', borderColor: '#4c8bf5', color: '#1a56db' };

const HEAD: ArrowHead = 'triangle';

export function LineFormatBar(): React.ReactElement | null {
  const deck = useDeck();
  const selection = useSelection();
  const id = selection.elementIds.length === 1 ? selection.elementIds[0] : null;
  const el = useElement(id ?? '') as LineElement | undefined;
  if (!id || !el || el.type !== 'line') return null;

  const hasStart = (el.startArrow ?? 'none') !== 'none';
  const hasEnd = (el.endArrow ?? 'none') !== 'none';
  const mode: 'none' | 'start' | 'end' | 'both' =
    hasStart && hasEnd ? 'both' : hasStart ? 'start' : hasEnd ? 'end' : 'none';

  const set = (startArrow: ArrowHead, endArrow: ArrowHead) => deck.updateElement(id, { startArrow, endArrow });
  const style = (m: typeof mode) => (mode === m ? { ...btn, ...active } : btn);

  return (
    <>
      <span style={{ width: 1, height: 22, background: '#e2e4e8', margin: '0 4px' }} />
      <button title="No arrow" style={style('none')} onClick={() => set('none', 'none')}>
        <Minus size={15} />
      </button>
      <button title="Arrow (start)" style={style('start')} onClick={() => set(HEAD, 'none')}>
        <MoveLeft size={15} />
      </button>
      <button title="Arrow (end)" style={style('end')} onClick={() => set('none', HEAD)}>
        <MoveRight size={15} />
      </button>
      <button title="Arrows (both sides)" style={style('both')} onClick={() => set(HEAD, HEAD)}>
        <MoveHorizontal size={15} />
      </button>
    </>
  );
}

// Materialize a layout's placeholders into real elements. addSlide({ layoutId })
// calls this so a new slide arrives with editable title/body/etc. elements
// carrying placeholder metadata (kept for PPTX fidelity) and the layout's
// default text style baked into each element's bodyStyle.

import { createTextElement } from '../scene/elements';
import { emptyRichText } from '../text/model';
import type { TextElement } from '../scene/types';
import type { PlaceholderDef } from './types';

/** Build the element for one placeholder at the given z-index. */
export function buildPlaceholderElement(ph: PlaceholderDef, containerId: string, index: string): TextElement {
  const style = ph.style ?? {};
  const doc = emptyRichText();
  if (style.align) doc.content[0].attrs = { ...doc.content[0].attrs, align: style.align };

  return createTextElement({
    containerId,
    index,
    x: ph.frame.x,
    y: ph.frame.y,
    w: ph.frame.w,
    h: ph.frame.h,
    rotation: ph.frame.rotation,
    placeholder: { type: ph.type, idx: ph.idx },
    richText: doc,
    bodyStyle: {
      vAlign: style.vAlign ?? 'top',
      padding: 8,
      fontSize: style.fontSize,
      color: style.color,
      bold: style.bold,
      fontFamily: style.font,
    },
  });
}

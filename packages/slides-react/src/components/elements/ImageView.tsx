import React from 'react';
import type { ImageElement } from '@weavertime/spindle-slides-core';

export function ImageView({ el }: { el: ImageElement }): React.ReactElement {
  const flip = el.flipH || el.flipV ? `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` : undefined;
  return (
    <img
      src={el.src}
      alt=""
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        display: 'block',
        transform: flip,
        transformOrigin: 'center center',
        userSelect: 'none',
      }}
    />
  );
}

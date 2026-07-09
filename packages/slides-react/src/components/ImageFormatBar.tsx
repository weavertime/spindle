// ImageFormatBar — inline image controls, rendered in the main Toolbar row (like
// the other format bars) when a single image is selected: replace the source
// (file or URL) and flip horizontally / vertically. The model already carries
// src / naturalW / naturalH / flipH / flipV.

import React, { useRef } from 'react';
import { ImageUp, Link2, FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { ImageElement } from '@weavertime/spindle-slides-core';
import { useDeck, useSelection, useElement } from '../hooks';
import { ToolbarButton, ToolbarDivider } from './toolbarUI';

/** Load an image and resolve its natural pixel size (or reject). */
function loadImage(src: string): Promise<{ naturalW: number; naturalH: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

export function ImageFormatBar(): React.ReactElement | null {
  const deck = useDeck();
  const selection = useSelection();
  const fileRef = useRef<HTMLInputElement>(null);
  const id = selection.elementIds.length === 1 ? selection.elementIds[0] : null;
  const el = useElement(id ?? '') as ImageElement | undefined;
  if (!id || !el || el.type !== 'image') return null;

  const replace = async (src: string) => {
    try {
      const { naturalW, naturalH } = await loadImage(src);
      deck.updateElement(id, { src, naturalW, naturalH });
    } catch {
      /* couldn't load — leave the current image untouched */
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => replace(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const replaceByUrl = () => {
    const url = window.prompt('Image URL', el.src.startsWith('data:') ? '' : el.src);
    if (url && url.trim()) replace(url.trim());
  };

  return (
    <>
      <ToolbarDivider />
      <ToolbarButton title="Replace image (upload)" onClick={() => fileRef.current?.click()}>
        <ImageUp size={15} />
      </ToolbarButton>
      <ToolbarButton title="Replace with image URL" onClick={replaceByUrl}>
        <Link2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="Flip horizontal" active={!!el.flipH} onClick={() => deck.updateElement(id, { flipH: !el.flipH })}>
        <FlipHorizontal2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="Flip vertical" active={!!el.flipV} onClick={() => deck.updateElement(id, { flipV: !el.flipV })}>
        <FlipVertical2 size={15} />
      </ToolbarButton>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </>
  );
}

// PDF export via the print pipeline (v1). Renders every slide at native size
// into a hidden iframe with `@page { size: WxH; margin: 0 }` and a page break
// per slide, waits for fonts + images, then calls print(). The user picks
// "Save as PDF". A real PDF backend is a follow-up.
//
// Documented limitations: relies on the browser's print-to-PDF; Firefox has
// `@page size` quirks; exact colors depend on the user's "background graphics"
// print setting.

import React from 'react';
import { createRoot } from 'react-dom/client';
import type { DeckImpl } from '@weavertime/spindle-slides-core';
import { DeckProvider } from '../../context/DeckContext';
import { SlideView } from '../SlideView';

function PrintDeck({ deck }: { deck: DeckImpl }): React.ReactElement {
  const ids = deck.getSlideIds();
  const { w, h } = deck.getSlideSize();
  return (
    <>
      {ids.map((id) => (
        <div key={id} className="print-page" style={{ width: w, height: h, overflow: 'hidden', position: 'relative' }}>
          <SlideView slideId={id} />
        </div>
      ))}
    </>
  );
}

export async function exportDeckToPdf(deck: DeckImpl): Promise<void> {
  const { w, h } = deck.getSlideSize();
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // Give the print frame a real slide-sized layout viewport (off-screen). A
  // 1px iframe leaves the print engine without a proper containing block, so
  // Chrome ignores the @page size and falls back to the default paper —
  // letterboxing the 16:9 slide with a white bar at the bottom.
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px;opacity:0;border:0;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(
    `<!doctype html><html><head><style>` +
      `@page { size: ${w}px ${h}px; margin: 0; }` +
      `html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
      `.print-page{ width:${w}px; height:${h}px; overflow:hidden; page-break-after: always; break-after: page; -webkit-print-color-adjust:exact; print-color-adjust:exact; }` +
      `.print-page:last-child{ page-break-after: auto; break-after: auto; }` +
      `</style></head><body></body></html>`
  );
  doc.close();

  const root = createRoot(doc.body);
  await new Promise<void>((resolve) => {
    root.render(
      <DeckProvider deck={deck}>
        <PrintDeck deck={deck} />
      </DeckProvider>
    );
    setTimeout(resolve, 60);
  });

  try {
    await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* fonts API unavailable */
  }
  await Promise.all(Array.from(doc.images).map((img) => img.decode?.().catch(() => {})));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  // Leave the iframe up briefly (the print dialog is modal), then clean up.
  setTimeout(() => {
    root.unmount();
    iframe.remove();
  }, 1500);
}

// setData validation + defaulting. getData() emits a fully-populated DeckData,
// but hand- or AI-authored JSON may omit ids, fractional indices, or the
// theme. normalizeDeckData fills those in so authoring a deck by hand stays
// easy: give it slides with elements in array order and it assigns everything
// order-sensitive.

import { generateId } from './utils/id';
import { indexesBetween } from './scene/fractional-index';
import { getBuiltinTheme, DEFAULT_SLIDE_SIZE } from './theme/builtin';
import type { SlideElement } from './scene/types';
import type { DeckData, SlideData } from './types';

/** Assign ascending fractional indices to items missing one, preserving array order. */
function ensureIndices<T extends { index?: string }>(items: T[]): Array<T & { index: string }> {
  const allHaveIndex = items.every((it) => typeof it.index === 'string' && it.index.length > 0);
  if (allHaveIndex) return items as Array<T & { index: string }>;
  // Mixing given indices with freshly generated ones sorts unpredictably (an
  // author's 'zzz' would jump ahead of a generated 'a2'). When any index is
  // missing the set can't be trusted for ordering, so assign fresh monotonically
  // increasing keys across the whole array — this preserves the given array order.
  const keys = indexesBetween(null, null, items.length);
  return items.map((it, i) => ({ ...it, index: keys[i] }));
}

function normalizeSlide(slide: SlideData): SlideData {
  const id = slide.id || generateId();
  const rawElements = slide.elements ?? [];
  const withIndices = ensureIndices(
    rawElements.map((el) => ({ ...el, id: el.id || generateId(), containerId: id }))
  ) as SlideElement[];
  return { ...slide, id, elements: withIndices };
}

export function normalizeDeckData(data: DeckData): DeckData {
  const rawSlides = data.slides ?? [];
  const slides = ensureIndices(rawSlides.map(normalizeSlide)) as SlideData[];

  return {
    id: data.id ?? generateId(),
    title: data.title ?? 'Untitled deck',
    slideSize: data.slideSize ?? { ...DEFAULT_SLIDE_SIZE },
    theme: data.theme ?? getBuiltinTheme(),
    layouts: data.layouts,
    slides,
    threads: data.threads,
    selection: data.selection,
  };
}

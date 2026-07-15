import {
  computeTrueLayout,
  findBlockPage,
  findBlockFragments,
  getPageY,
  findPageAtY,
  type LayoutOptions,
} from './true-layout-engine';
import type { FlowBlock } from './flow-blocks';
import type { Measure, LineMeasure, ParagraphMeasure, PageBreakMeasure, ImageMeasure } from './measurer';

// --- fixtures ---------------------------------------------------------------

// A US-Letter-ish page: content area is 600px tall (height 700, 50px margins).
const CONTENT_HEIGHT = 600;
const opts = (over: Partial<LayoutOptions> = {}): LayoutOptions => ({
  pageConfig: { width: 800, height: 700, margins: { top: 50, right: 50, bottom: 50, left: 50 } },
  scale: 1,
  pageGap: 24,
  minLinesAtBreak: 2,
  ...over,
});

const block = (id: string): FlowBlock => ({ id, type: 'paragraph', content: [] } as unknown as FlowBlock);

const lineOf = (height: number): LineMeasure => ({ height, width: 100, ascent: height * 0.8, descent: height * 0.2, yOffset: 0 });

// Paragraph with `n` lines each `lineHeight` tall (no space before/after by default).
const para = (id: string, lineHeight: number, n: number, spaceBefore = 0, spaceAfter = 0): ParagraphMeasure => ({
  kind: 'paragraph',
  blockId: id,
  lines: Array.from({ length: n }, () => lineOf(lineHeight)),
  totalHeight: spaceBefore + lineHeight * n + spaceAfter,
  spaceBefore,
  spaceAfter,
});

const pageBreak = (id: string): PageBreakMeasure => ({ kind: 'pageBreak', blockId: id, totalHeight: 0, forceBreak: true });
const image = (id: string, height: number): ImageMeasure => ({ kind: 'image', blockId: id, totalHeight: height, width: 200 });

function layout(pairs: Array<{ b: FlowBlock; m: Measure }>, over?: Partial<LayoutOptions>) {
  return computeTrueLayout(pairs.map((p) => p.b), pairs.map((p) => p.m), opts(over));
}

// --- tests ------------------------------------------------------------------

describe('computeTrueLayout — single page', () => {
  it('places a block that fits as one full fragment', () => {
    const l = layout([{ b: block('a'), m: para('a', 20, 3) }]);
    expect(l.pages).toHaveLength(1);
    expect(l.pages[0].fragments).toHaveLength(1);
    expect(l.pages[0].fragments[0]).toMatchObject({ blockId: 'a', fromLine: 0, toLine: 3, y: 0, isFirstFragment: true, isLastFragment: true });
    expect(l.pages[0].contentHeight).toBe(60);
    expect(l.pages[0].remainingHeight).toBe(CONTENT_HEIGHT - 60);
  });

  it('stacks multiple blocks on one page with increasing y', () => {
    const l = layout([
      { b: block('a'), m: para('a', 20, 2) },
      { b: block('b'), m: para('b', 20, 2) },
    ]);
    expect(l.pages).toHaveLength(1);
    expect(l.pages[0].fragments.map((f) => f.y)).toEqual([0, 40]);
  });

  it('returns a single empty page for empty input', () => {
    const l = computeTrueLayout([], [], opts());
    expect(l.pages).toHaveLength(1);
    expect(l.pages[0].fragments).toHaveLength(0);
  });
});

describe('computeTrueLayout — pagination', () => {
  it('moves a whole block that does not fit to the next page', () => {
    // First block fills 580 of 600; a 3-line (60px) unsplittable-sized block...
    // is splittable, so use a single-line block that can't split.
    const l = layout([
      { b: block('a'), m: para('a', 580, 1) },
      { b: block('b'), m: para('b', 40, 1) },
    ]);
    expect(l.pages).toHaveLength(2);
    expect(l.pages[0].fragments.map((f) => f.blockId)).toEqual(['a']);
    expect(l.pages[1].fragments.map((f) => f.blockId)).toEqual(['b']);
  });

  it('splits a multi-line block across two pages at a line boundary', () => {
    // 40 lines × 20px = 800px total, content height 600 → ~30 lines fit, rest overflow.
    const l = layout([{ b: block('a'), m: para('a', 20, 40) }]);
    expect(l.pages.length).toBeGreaterThanOrEqual(2);
    const frags = l.pages.flatMap((p) => p.fragments).filter((f) => f.blockId === 'a');
    // Fragments must tile [0..40] with no gap or overlap and no lost lines.
    expect(frags[0].fromLine).toBe(0);
    for (let i = 1; i < frags.length; i++) expect(frags[i].fromLine).toBe(frags[i - 1].toLine);
    expect(frags[frags.length - 1].toLine).toBe(40);
    expect(frags[0].isFirstFragment).toBe(true);
    expect(frags[frags.length - 1].isLastFragment).toBe(true);
  });

  it('forces a new page on a pageBreak measure', () => {
    const l = layout([
      { b: block('a'), m: para('a', 20, 2) },
      { b: block('pb'), m: pageBreak('pb') },
      { b: block('b'), m: para('b', 20, 2) },
    ]);
    expect(l.pages).toHaveLength(2);
    expect(l.pages[0].fragments.map((f) => f.blockId)).toEqual(['a']);
    expect(l.pages[1].fragments.map((f) => f.blockId)).toEqual(['b']);
  });

  it('applies widow control: a lone trailing line is pushed to the next page', () => {
    // Page fits 30 lines (600/20). A 31-line block would leave 1 line alone on
    // page 2 — with minLinesAtBreak=2 the break moves up so ≥2 lines carry over.
    const l = layout([{ b: block('a'), m: para('a', 20, 31) }]);
    const lastPageFrag = l.pages[l.pages.length - 1].fragments.find((f) => f.blockId === 'a')!;
    expect(lastPageFrag.toLine - lastPageFrag.fromLine).toBeGreaterThanOrEqual(2);
  });
});

describe('computeTrueLayout — oversized content never vanishes', () => {
  it('lets an unsplittable block taller than the page overflow onto its own page', () => {
    const l = layout([{ b: block('img'), m: image('img', 900) }]);
    const frag = l.pages.flatMap((p) => p.fragments).find((f) => f.blockId === 'img');
    expect(frag).toBeDefined();
    // Regression: the fragment height was clamped to the page content height
    // (600), silently truncating the bottom 300px of the block. It must cover
    // the block's full measured height so no content is lost.
    expect(frag!.height).toBe(900);
  });

  it('preserves the full height of an unsplittable block preceded by content', () => {
    // A block that fills part of page 1, then a tall non-line block that cannot
    // split: the tall block moves to its own page and keeps its whole height.
    const l = layout([
      { b: block('a'), m: para('a', 20, 5) },
      { b: block('img'), m: image('img', 1000) },
    ]);
    const frag = l.pages.flatMap((p) => p.fragments).find((f) => f.blockId === 'img')!;
    expect(frag.height).toBe(1000);
  });

  it('keeps every line of a multi-line block whose first line is taller than the page', () => {
    // Regression: a line taller than a full page used to make the widow guard
    // return "0 lines fit", and the fragment loop then broke, silently dropping
    // the block. Every line must still be emitted across pages.
    const l = layout([{ b: block('a'), m: para('a', 700, 2) }]);
    const frags = l.pages.flatMap((p) => p.fragments).filter((f) => f.blockId === 'a');
    const linesCovered = frags.reduce((n, f) => n + (f.toLine - f.fromLine), 0);
    expect(linesCovered).toBe(2);
    expect(frags[0].fromLine).toBe(0);
    expect(frags[frags.length - 1].toLine).toBe(2);
  });
});

describe('layout query helpers', () => {
  const l = layout([
    { b: block('a'), m: para('a', 20, 40) }, // spans pages
    { b: block('b'), m: para('b', 20, 2) },
  ]);

  it('findBlockPage returns the first page a block appears on', () => {
    expect(findBlockPage(l, 'a')).toBe(0);
    expect(findBlockPage(l, 'missing')).toBeNull();
  });

  it('findBlockFragments returns every fragment of a block in order', () => {
    const frags = findBlockFragments(l, 'a');
    expect(frags.length).toBeGreaterThanOrEqual(2);
    expect(frags[0].fromLine).toBe(0);
  });

  it('getPageY increases by page height + gap per page', () => {
    expect(getPageY(l, 0)).toBe(0);
    expect(getPageY(l, 1)).toBe(700 + 24);
  });

  it('findPageAtY maps a y coordinate back to its page index', () => {
    expect(findPageAtY(l, 10)).toBe(0);
    expect(findPageAtY(l, 700 + 24 + 10)).toBe(1);
  });
});

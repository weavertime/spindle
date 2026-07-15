import { findRunAtOffset } from './selection';
import type { InlineContent } from './types';

const text = (t: string): InlineContent => ({ type: 'text', text: t });
const image = (): InlineContent => ({ type: 'image', src: 'x', width: 1, height: 1 });

describe('findRunAtOffset', () => {
  const content: InlineContent[] = [text('abc'), text('def')]; // [0..3) run0, [3..6) run1

  it('returns null for empty content', () => {
    expect(findRunAtOffset([], 0)).toBeNull();
  });

  it('finds a run for an offset strictly inside it', () => {
    expect(findRunAtOffset(content, 1)).toEqual({ runIndex: 0, offsetInRun: 1 });
    expect(findRunAtOffset(content, 4)).toEqual({ runIndex: 1, offsetInRun: 1 });
  });

  it('prefers the later run at an exact run boundary', () => {
    // Offset 3 is the boundary between run0 and run1; it must land at the start
    // of run1 (offsetInRun 0), not the end of run0, so typing inherits run1.
    expect(findRunAtOffset(content, 3)).toEqual({ runIndex: 1, offsetInRun: 0 });
  });

  it('lets the last run own its own end', () => {
    expect(findRunAtOffset(content, 6)).toEqual({ runIndex: 1, offsetInRun: 3 });
  });

  it('clamps an out-of-range offset to the end of the last run', () => {
    // offsetInRun must never exceed the run length (previously returned 4+).
    expect(findRunAtOffset(content, 20)).toEqual({ runIndex: 1, offsetInRun: 3 });
  });

  it('clamps a negative offset to the start of the first run', () => {
    expect(findRunAtOffset(content, -5)).toEqual({ runIndex: 0, offsetInRun: 0 });
  });

  it('handles image runs (length 1) at boundaries', () => {
    const withImage: InlineContent[] = [text('ab'), image(), text('cd')]; // 2 + 1 + 2
    // Boundary at offset 2 -> start of the image run.
    expect(findRunAtOffset(withImage, 2)).toEqual({ runIndex: 1, offsetInRun: 0 });
    // Boundary at offset 3 -> start of the trailing text run.
    expect(findRunAtOffset(withImage, 3)).toEqual({ runIndex: 2, offsetInRun: 0 });
  });
});

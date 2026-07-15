import { TextStylePoolImpl, ParagraphStylePoolImpl } from './style-pool';

describe('TextStylePoolImpl', () => {
  it('returns the same id for an identical style and a different id for a different one', () => {
    const pool = new TextStylePoolImpl();
    const bold = pool.getOrCreate({ bold: true });
    const boldAgain = pool.getOrCreate({ bold: true });
    const italic = pool.getOrCreate({ italic: true });
    expect(bold).toBe(boldAgain);
    expect(bold).not.toBe(italic);
  });

  it('resolves an id back to its style', () => {
    const pool = new TextStylePoolImpl();
    const id = pool.getOrCreate({ bold: true, italic: true });
    expect(pool.get(id)).toEqual({ bold: true, italic: true });
    expect(pool.get('missing')).toBeUndefined();
  });

  it('round-trips through toData / setFromData', () => {
    const pool = new TextStylePoolImpl();
    const id = pool.getOrCreate({ bold: true });
    const data = pool.toData();

    const restored = new TextStylePoolImpl();
    restored.setFromData(data);
    expect(restored.get(id)).toEqual({ bold: true });
    // Same style still de-dupes onto the restored id.
    expect(restored.getOrCreate({ bold: true })).toBe(id);
  });
});

describe('ParagraphStylePoolImpl', () => {
  it('de-dupes identical paragraph styles', () => {
    const pool = new ParagraphStylePoolImpl();
    const a = pool.getOrCreate({ alignment: 'center' });
    const b = pool.getOrCreate({ alignment: 'center' });
    expect(a).toBe(b);
    expect(pool.get(a)).toEqual({ alignment: 'center' });
  });
});

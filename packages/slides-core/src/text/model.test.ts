import {
  emptyRichText,
  richTextFromPlainText,
  richTextToPlainText,
  isRichTextEmpty,
  docHasMark,
  applyMarkToDoc,
  removeMarkFromDoc,
  toggleMarkInDoc,
  setParagraphAttrs,
  applyTextFormat,
  type RichTextDoc,
} from './model';

const sample = (): RichTextDoc => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Line 2' }] },
  ],
});

describe('plain-text conversion', () => {
  it('round-trips plain text through paragraphs', () => {
    const doc = richTextFromPlainText('a\nb\nc');
    expect(doc.content).toHaveLength(3);
    expect(richTextToPlainText(doc)).toBe('a\nb\nc');
  });

  it('detects empty bodies', () => {
    expect(isRichTextEmpty(emptyRichText())).toBe(true);
    expect(isRichTextEmpty(richTextFromPlainText('x'))).toBe(false);
  });
});

describe('marks', () => {
  it('applies a mark to every run and detects it', () => {
    const bolded = applyMarkToDoc(sample(), { type: 'bold' });
    expect(docHasMark(bolded, 'bold')).toBe(true);
    expect(docHasMark(sample(), 'bold')).toBe(false);
  });

  it('replaces a parameterized mark rather than duplicating it', () => {
    let doc = applyMarkToDoc(sample(), { type: 'fontSize', attrs: { size: 20 } });
    doc = applyMarkToDoc(doc, { type: 'fontSize', attrs: { size: 40 } });
    const marks = doc.content[0].content![0].marks!;
    expect(marks.filter((m) => m.type === 'fontSize')).toHaveLength(1);
    expect(marks.find((m) => m.type === 'fontSize')!.attrs!.size).toBe(40);
  });

  it('removes a mark and cleans up empty mark arrays', () => {
    const bolded = applyMarkToDoc(sample(), { type: 'bold' });
    const plain = removeMarkFromDoc(bolded, 'bold');
    expect(docHasMark(plain, 'bold')).toBe(false);
    expect(plain.content[0].content![0].marks).toBeUndefined();
  });

  it('toggles a mark on then off', () => {
    const on = toggleMarkInDoc(sample(), 'italic');
    expect(docHasMark(on, 'italic')).toBe(true);
    const off = toggleMarkInDoc(on, 'italic');
    expect(docHasMark(off, 'italic')).toBe(false);
  });
});

describe('paragraph attrs & applyTextFormat', () => {
  it('sets paragraph attrs across all paragraphs', () => {
    const doc = setParagraphAttrs(sample(), { align: 'center', listType: 'bullet' });
    expect(doc.content.every((p) => p.attrs?.align === 'center' && p.attrs?.listType === 'bullet')).toBe(true);
  });

  it('applies a combined format spec', () => {
    const doc = applyTextFormat(sample(), {
      toggleMark: 'bold',
      setMark: { type: 'textColor', attrs: { color: { kind: 'theme', slot: 'accent1' } } },
      paragraph: { align: 'right' },
    });
    expect(docHasMark(doc, 'bold')).toBe(true);
    expect(docHasMark(doc, 'textColor')).toBe(true);
    expect(doc.content[0].attrs?.align).toBe('right');
  });

  it('does not mutate the input', () => {
    const input = sample();
    applyMarkToDoc(input, { type: 'bold' });
    setParagraphAttrs(input, { align: 'center' });
    expect(input.content[0].content![0].marks).toBeUndefined();
    expect(input.content[0].attrs).toBeUndefined();
  });
});

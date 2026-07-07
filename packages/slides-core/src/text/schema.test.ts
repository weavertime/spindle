import { slidesSchema } from './schema';
import type { RichTextDoc } from './model';

const rich: RichTextDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: 'center', listType: 'bullet', indent: 1, lineHeight: 1.4, spaceBefore: 0, spaceAfter: 8 },
      content: [
        { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'blue', marks: [{ type: 'textColor', attrs: { color: { kind: 'rgb', hex: '#2D7FF9' } } }] },
        { type: 'text', text: ' big', marks: [{ type: 'fontSize', attrs: { size: 32 } }] },
      ],
    },
  ],
};

describe('slidesSchema round-trip', () => {
  it('parses RichTextDoc JSON and re-serializes it losslessly', () => {
    const node = slidesSchema.nodeFromJSON(rich);
    const json = node.toJSON();
    // Marks + text + attrs survive.
    expect(json.content[0].content[0].marks[0].type).toBe('bold');
    expect(json.content[0].content[1].marks[0].attrs.color.hex).toBe('#2D7FF9');
    expect(json.content[0].content[2].marks[0].attrs.size).toBe(32);
    expect(json.content[0].attrs.align).toBe('center');
    expect(json.content[0].attrs.listType).toBe('bullet');
  });

  it('is idempotent (re-parsing the serialized form yields the same JSON)', () => {
    const json1 = slidesSchema.nodeFromJSON(rich).toJSON();
    const json2 = slidesSchema.nodeFromJSON(json1).toJSON();
    expect(json2).toEqual(json1);
  });

  it('fills default paragraph attrs for a bare doc', () => {
    const json = slidesSchema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] }).toJSON();
    expect(json.content[0].attrs).toMatchObject({ align: 'left', listType: 'none', indent: 0 });
  });
});

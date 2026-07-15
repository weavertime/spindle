import { Schema, Node as PmNode } from 'prosemirror-model';
import { proseMirrorToFlowBlocks } from './pm-to-blocks';
import type { ParagraphBlock, LinkRun } from './flow-blocks';

// Minimal schema: enough to build a paragraph containing a linked text run.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
  marks: {
    link: {
      attrs: { href: {} },
      toDOM: (m) => ['a', { href: m.attrs.href }, 0],
    },
  },
});

function docWithLink(href: string): PmNode {
  const mark = schema.marks.link.create({ href });
  const textNode = schema.text('click me', [mark]);
  const para = schema.nodes.paragraph.create(null, textNode);
  return schema.nodes.doc.create(null, para);
}

describe('proseMirrorToFlowBlocks — link marks', () => {
  it('maps a link mark to a LinkRun carrying the href (not a plain text run)', () => {
    const blocks = proseMirrorToFlowBlocks(docWithLink('https://example.com'));
    const para = blocks[0] as ParagraphBlock;
    expect(para.kind).toBe('paragraph');
    const run = para.runs[0] as LinkRun;
    expect(run.kind).toBe('link');
    expect(run.href).toBe('https://example.com');
    expect(run.text).toBe('click me');
    expect(run.underline).toBe(true);
  });

  it('neutralizes a javascript: href when building the model', () => {
    const blocks = proseMirrorToFlowBlocks(docWithLink('javascript:alert(1)'));
    const run = (blocks[0] as ParagraphBlock).runs[0] as LinkRun;
    expect(run.kind).toBe('link');
    expect(run.href).toBe('');
  });
});

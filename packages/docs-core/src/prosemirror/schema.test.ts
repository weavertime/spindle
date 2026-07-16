import { docsSchema } from './schema';

// Extract the inline `style` string from a DOMOutputSpec array like
// ['p', { style: '…' }, 0].
function styleOf(spec: unknown): string {
  const attrs =
    Array.isArray(spec) && spec[1] && typeof spec[1] === 'object'
      ? (spec[1] as Record<string, string>)
      : {};
  return attrs.style || '';
}

function nodeStyle(name: string, attrs: Record<string, unknown>): string {
  const node = docsSchema.nodes[name].create(attrs);
  const toDOM = docsSchema.nodes[name].spec.toDOM as (n: typeof node) => unknown;
  return styleOf(toDOM(node));
}

function markStyle(name: string, attrs: Record<string, unknown>): string {
  const mark = docsSchema.marks[name].create(attrs);
  const toDOM = docsSchema.marks[name].spec.toDOM as (m: typeof mark, inline: boolean) => unknown;
  return styleOf(toDOM(mark, false));
}

describe('docsSchema toDOM sanitizes untrusted block attrs', () => {
  it('paragraph: whitelists alignment and coerces spacing', () => {
    expect(nodeStyle('paragraph', { alignment: 'center', spaceBefore: 4, spaceAfter: 6 })).toBe(
      'text-align: center; margin-top: 4px; margin-bottom: 6px;'
    );
    // A CSS-injection payload in alignment falls back to the default keyword.
    const injected = nodeStyle('paragraph', {
      alignment: 'left; background: url(//evil)',
      spaceBefore: '0; background: url(//evil)',
      spaceAfter: 8,
    });
    expect(injected).toContain('text-align: left;');
    expect(injected).not.toContain('url(');
    expect(injected).not.toContain('background');
  });

  it('heading: whitelists alignment', () => {
    expect(nodeStyle('heading', { level: 2, alignment: 'right' })).toBe('text-align: right');
    const injected = nodeStyle('heading', { level: 1, alignment: 'left; background: url(//evil)' });
    expect(injected).toBe('text-align: left');
  });

  it('textStyle: coerces fontSize to a number', () => {
    expect(markStyle('textStyle', { fontSize: 12 })).toContain('font-size: 12pt');
    const injected = markStyle('textStyle', { fontSize: '0pt; background: url(//evil)' });
    expect(injected).not.toContain('url(');
    expect(injected).not.toContain('background');
  });
});

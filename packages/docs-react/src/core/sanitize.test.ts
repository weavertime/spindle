import {
  sanitizeHref,
  sanitizeImageSrc,
  safeCssColor,
  safeFontFamily,
  safeCssKeyword,
  safeLineHeight,
} from './sanitize';

describe('sanitizeHref', () => {
  it('neutralizes javascript:/vbscript:/data: hrefs', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('');
    expect(sanitizeHref('JavaScript:alert(1)')).toBe('');
    expect(sanitizeHref('  javascript:alert(1)')).toBe('');
    expect(sanitizeHref('java\tscript:alert(1)')).toBe('');
    expect(sanitizeHref('vbscript:x')).toBe('');
    expect(sanitizeHref('data:text/html,<script>')).toBe('');
  });

  it('allows safe schemes and relative/anchor URLs', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeHref('tel:+1555')).toBe('tel:+1555');
    expect(sanitizeHref('/rel')).toBe('/rel');
    expect(sanitizeHref('#a')).toBe('#a');
  });
});

describe('sanitizeImageSrc', () => {
  it('allows http/https/data:image and relative, rejects javascript', () => {
    expect(sanitizeImageSrc('https://x/y.png')).toBe('https://x/y.png');
    expect(sanitizeImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(sanitizeImageSrc('/images/a.png')).toBe('/images/a.png');
    expect(sanitizeImageSrc('javascript:alert(1)')).toBe('');
    // Non-image data URIs are rejected.
    expect(sanitizeImageSrc('data:text/html,<script>')).toBe('');
  });
});

describe('safeCssColor', () => {
  it('accepts hex, functional, and keyword colors', () => {
    expect(safeCssColor('#fff')).toBe('#fff');
    expect(safeCssColor('#1a73e8')).toBe('#1a73e8');
    expect(safeCssColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(safeCssColor('rgba(1,2,3,0.5)')).toBe('rgba(1,2,3,0.5)');
    expect(safeCssColor('red')).toBe('red');
    expect(safeCssColor('transparent')).toBe('transparent');
  });

  it('accepts modern color forms (var/oklch/lab/color-mix)', () => {
    expect(safeCssColor('var(--brand)')).toBe('var(--brand)');
    expect(safeCssColor('oklch(0.7 0.15 200)')).toBe('oklch(0.7 0.15 200)');
    expect(safeCssColor('lab(50% 40 59.5)')).toBe('lab(50% 40 59.5)');
    expect(safeCssColor('color-mix(in srgb, red 40%, blue)')).toBe('color-mix(in srgb, red 40%, blue)');
    expect(safeCssColor('rgb(0 0 0 / 50%)')).toBe('rgb(0 0 0 / 50%)');
  });

  it('rejects CSS injection payloads', () => {
    expect(safeCssColor('red; background: url(//evil)')).toBeUndefined();
    expect(safeCssColor('red;}body{display:none')).toBeUndefined();
    expect(safeCssColor('url(//evil)')).toBeUndefined();
    expect(safeCssColor('var(--x); background: url(//evil)')).toBeUndefined();
    expect(safeCssColor('color-mix(in srgb, url(//evil), blue)')).toBeUndefined();
    expect(safeCssColor('')).toBeUndefined();
  });

  it('does not catastrophically backtrack on a long ambiguous input (ReDoS)', () => {
    const evil = 'rgb(' + ' '.repeat(50000) + '!';
    const start = Date.now();
    expect(safeCssColor(evil)).toBeUndefined();
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe('safeFontFamily', () => {
  it('accepts normal font-family lists and generic families', () => {
    expect(safeFontFamily('Arial, sans-serif')).toBe('Arial, sans-serif');
    expect(safeFontFamily('"Helvetica Neue", Helvetica')).toBe('"Helvetica Neue", Helvetica');
    expect(safeFontFamily('monospace')).toBe('monospace');
  });

  it('rejects injection via url/braces/semicolons/parens', () => {
    expect(safeFontFamily('Arial; background: url(//evil)')).toBeUndefined();
    expect(safeFontFamily('foo{color:red}')).toBeUndefined();
    expect(safeFontFamily('url(//evil)')).toBeUndefined();
    expect(safeFontFamily('a:b')).toBeUndefined();
    expect(safeFontFamily('')).toBeUndefined();
    expect(safeFontFamily(null)).toBeUndefined();
  });
});

describe('safeCssKeyword', () => {
  it('allows only alignment keywords, lower-cased', () => {
    expect(safeCssKeyword('left')).toBe('left');
    expect(safeCssKeyword('CENTER')).toBe('center');
    expect(safeCssKeyword('justify')).toBe('justify');
    expect(safeCssKeyword('start')).toBe('start');
  });

  it('rejects anything else', () => {
    expect(safeCssKeyword('left; background: url(//evil)')).toBeUndefined();
    expect(safeCssKeyword('inherit')).toBeUndefined();
    expect(safeCssKeyword('')).toBeUndefined();
  });
});

describe('safeLineHeight', () => {
  it('coerces finite positive numbers, rejects the rest', () => {
    expect(safeLineHeight(1.5)).toBe(1.5);
    expect(safeLineHeight('2')).toBe(2);
    expect(safeLineHeight('1.4; background: url(//evil)')).toBe(1.4);
    expect(safeLineHeight('nope')).toBeUndefined();
    expect(safeLineHeight(0)).toBeUndefined();
    expect(safeLineHeight(-1)).toBeUndefined();
  });
});

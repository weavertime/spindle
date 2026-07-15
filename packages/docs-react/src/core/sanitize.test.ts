import { sanitizeHref, sanitizeImageSrc, safeCssColor } from './sanitize';

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

  it('rejects CSS injection payloads', () => {
    expect(safeCssColor('red; background: url(//evil)')).toBeUndefined();
    expect(safeCssColor('red;}body{display:none')).toBeUndefined();
    expect(safeCssColor('url(//evil)')).toBeUndefined();
    expect(safeCssColor('')).toBeUndefined();
  });
});

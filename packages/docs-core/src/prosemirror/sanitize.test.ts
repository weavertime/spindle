import { sanitizeHref } from './sanitize';

describe('sanitizeHref', () => {
  it('neutralizes javascript: hrefs', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('');
    expect(sanitizeHref('JavaScript:alert(1)')).toBe('');
    expect(sanitizeHref('  javascript:alert(1)  ')).toBe('');
    // Browsers ignore whitespace/control chars inside the scheme.
    expect(sanitizeHref('java\tscript:alert(1)')).toBe('');
    expect(sanitizeHref('java\nscript:alert(1)')).toBe('');
  });

  it('rejects vbscript: and data: hrefs', () => {
    expect(sanitizeHref('vbscript:msgbox(1)')).toBe('');
    expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('allows safe schemes and relative/anchor URLs', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('http://example.com')).toBe('http://example.com');
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeHref('tel:+15551234')).toBe('tel:+15551234');
    expect(sanitizeHref('/relative/path')).toBe('/relative/path');
    expect(sanitizeHref('#anchor')).toBe('#anchor');
    expect(sanitizeHref('page.html?x=1:2')).toBe('page.html?x=1:2');
  });

  it('returns empty for empty/nullish input', () => {
    expect(sanitizeHref('')).toBe('');
    expect(sanitizeHref(null)).toBe('');
    expect(sanitizeHref(undefined)).toBe('');
  });
});

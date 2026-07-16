/**
 * Render-boundary sanitizers.
 *
 * Untrusted document content (hrefs, image sources, colors) is interpolated
 * into DOM attributes and inline styles by the painter/measurer. These helpers
 * neutralize XSS and CSS-injection vectors at that boundary. They are
 * intentionally conservative allowlists — reject anything not clearly safe.
 */

/** Schemes permitted for hyperlink hrefs. */
const SAFE_HREF_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/** Schemes permitted for image sources (plus a `data:image/` special case). */
const SAFE_IMAGE_SCHEMES = ['http:', 'https:'];

// ASCII whitespace + C0 control characters (0x00–0x20). Browsers ignore these
// inside a URL scheme, so `java\tscript:` runs as `javascript:`; strip them
// before comparing the scheme against the allowlist.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0020]/g;

/**
 * Extract the (control-char-stripped, lower-cased) URL scheme, or null when the
 * value has no scheme — i.e. it is a relative, root-relative, protocol-relative,
 * anchor, or query URL, all of which are safe.
 */
function urlScheme(value: string): string | null {
  const colon = value.indexOf(':');
  if (colon === -1) return null;
  const beforeSlash = value.search(/[/?#]/);
  // A ':' that appears after the first '/', '?' or '#' is part of the path,
  // not a scheme delimiter (e.g. "/a:b" or "page.html?x=1:2").
  if (beforeSlash !== -1 && beforeSlash < colon) return null;
  return value.slice(0, colon + 1).replace(CONTROL_CHARS, '').toLowerCase();
}

/**
 * Sanitize a hyperlink href.
 *
 * Allows http:, https:, mailto:, tel:, and relative/anchor URLs. Rejects
 * javascript:, vbscript:, data:, and any other scheme by returning ''.
 */
export function sanitizeHref(href: string | null | undefined): string {
  if (!href) return '';
  const value = String(href).trim();
  if (value === '') return '';
  const scheme = urlScheme(value);
  if (scheme === null) return value; // relative / anchor / protocol-relative
  return SAFE_HREF_SCHEMES.includes(scheme) ? value : '';
}

/**
 * Sanitize an image `src`.
 *
 * Allows http:, https:, `data:image/…`, and relative URLs. Rejects
 * javascript: and everything else by returning ''.
 */
export function sanitizeImageSrc(src: string | null | undefined): string {
  if (!src) return '';
  const value = String(src).trim();
  if (value === '') return '';
  const scheme = urlScheme(value);
  if (scheme === null) return value; // relative / protocol-relative
  if (SAFE_IMAGE_SCHEMES.includes(scheme)) return value;
  const stripped = value.replace(CONTROL_CHARS, '');
  if (/^data:image\//i.test(stripped)) return value;
  return '';
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// rgb/rgba/hsl/hsla/hwb/lab/lch/oklab/oklch/color/color-mix/var, with an
// argument list drawn from a safe character set (digits, spaces, commas, dots,
// %, /, hyphens, `#`, `_`, and nested parens for color-mix()/var()).
//
// ReDoS note: there is intentionally NO leading `\s*` before the char class —
// the class already matches `\s`, and that adjacency (`\s*[...\s...]+`) causes
// polynomial backtracking. A single greedy `+` over one char class is linear.
const FN_COLOR =
  /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([a-z0-9.,%/()#_\s-]+\)$/i;
const KEYWORD_COLOR = /^[a-zA-Z]+$/;

/**
 * Return `color` if it is a safe CSS color token (hex, a whitelisted color
 * function such as rgb()/hsl()/oklch()/lab()/color-mix(), a `var(--…)`
 * reference, or a bare keyword such as `red`/`transparent`/`currentColor`),
 * otherwise undefined.
 *
 * This blocks CSS injection like `red; background: url(//evil)` — the semicolon
 * and `url(` make it match none of the allowed forms.
 */
export function safeCssColor(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  const value = String(color).trim();
  if (value === '') return undefined;
  // Defense in depth: `url(` never belongs in a color and could fetch a remote
  // resource; reject it even though the function forms below would already fail.
  if (/url\(/i.test(value)) return undefined;
  if (HEX_COLOR.test(value) || FN_COLOR.test(value) || KEYWORD_COLOR.test(value)) {
    return value;
  }
  return undefined;
}

// font-family tokens: letters, digits, spaces, commas, quotes, hyphens only.
// The class excludes ';', '{', '}', '(', ')', ':' — the characters needed to
// break out of the declaration — and we additionally reject any `url` substring.
const SAFE_FONT_FAMILY = /^[a-zA-Z0-9\s,'"-]+$/;

/**
 * Return `value` if it is a safe CSS `font-family` list, otherwise undefined.
 * Blocks CSS injection via unbalanced quotes, `url(...)`, or extra declarations.
 */
export function safeFontFamily(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = String(value).trim();
  if (v === '') return undefined;
  // Reject an actual url() call, not any name merely containing "url" (e.g. the
  // legitimate font "Curlz MT"). The char-class allowlist already forbids the
  // '(' a real url() needs, so this is just defense in depth.
  if (/url\(/i.test(v)) return undefined;
  return SAFE_FONT_FAMILY.test(v) ? v : undefined;
}

// The only keywords ever emitted for `text-align`.
const ALIGN_KEYWORDS = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

/**
 * Return a whitelisted CSS alignment keyword (lower-cased), or undefined.
 * Prevents `left; background: url(//evil)`-style injection at alignment sinks.
 */
export function safeCssKeyword(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = String(value).trim().toLowerCase();
  return ALIGN_KEYWORDS.has(v) ? v : undefined;
}

/**
 * Coerce a line-height to a finite positive number, or undefined. Numeric
 * line-heights can never carry a CSS-injection payload.
 */
export function safeLineHeight(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Coerce a value to a finite CSS length in px, falling back to `fallback` when
 * it isn't a finite number. A number can never carry a CSS-injection payload, so
 * this neutralizes numeric style attrs (spacing, indents, font-size) that are
 * interpolated into a style string.
 */
export function safeCssNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

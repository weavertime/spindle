// URL sanitizer for the slide-text render boundary.
//
// Hrefs on link marks come from pasted/imported HTML and are attacker
// controlled. This allowlist neutralizes javascript:, vbscript:, data: and
// other XSS vectors before an href is stored on a mark or rendered to an
// anchor. Kept local to slides-core so there is no cross-package dependency.

/** Schemes permitted for hyperlink hrefs. */
const SAFE_HREF_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

// ASCII whitespace + C0 control characters (0x00–0x20). Browsers ignore these
// inside a URL scheme, so `java\tscript:` runs as `javascript:`; strip them
// before comparing the scheme against the allowlist.
// eslint-disable-next-line no-control-regex -- stripping control chars is the point
const CONTROL_CHARS = /[\u0000-\u0020]/g;

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
  const colon = value.indexOf(':');
  if (colon === -1) return value; // relative / anchor / query — no scheme
  const beforeSlash = value.search(/[/?#]/);
  // A ':' after the first '/', '?' or '#' is part of the path, not a scheme.
  if (beforeSlash !== -1 && beforeSlash < colon) return value;
  const scheme = value.slice(0, colon + 1).replace(CONTROL_CHARS, '').toLowerCase();
  return SAFE_HREF_SCHEMES.includes(scheme) ? value : '';
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// A whitelisted color function or var() reference over a safe character set.
// No leading `\s*` (avoids ReDoS — the class already matches whitespace).
const FN_COLOR =
  /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([a-z0-9.,%/()#_\s-]+\)$/i;
const KEYWORD_COLOR = /^[a-zA-Z]+$/;

/**
 * Return `color` if it is a safe CSS color token, otherwise undefined. Blocks
 * CSS injection such as `red;background:url(//evil)` at the toDOM boundary,
 * where a literal `hex` from imported/collaborator JSON is interpolated raw.
 */
export function safeCssColor(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  const value = String(color).trim();
  if (value === '') return undefined;
  if (/url\(/i.test(value)) return undefined;
  if (HEX_COLOR.test(value) || FN_COLOR.test(value) || KEYWORD_COLOR.test(value)) {
    return value;
  }
  return undefined;
}

// font-family: letters, digits, spaces, commas, quotes, hyphens. Excludes the
// characters (';{}():') needed to break out of the declaration.
const SAFE_FONT_FAMILY = /^[a-zA-Z0-9\s,'"-]+$/;

/**
 * Return `value` if it is a safe CSS `font-family` list, otherwise undefined.
 */
export function safeFontFamily(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = String(value).trim();
  if (v === '') return undefined;
  if (/url/i.test(v)) return undefined;
  return SAFE_FONT_FAMILY.test(v) ? v : undefined;
}

// The 12 PPTX theme slots that may appear in a `var(--slot-…)` reference.
const THEME_SLOTS = new Set([
  'dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4',
  'accent5', 'accent6', 'hlink', 'folHlink',
]);

/** Return the slot name if it is a known theme slot, otherwise undefined. */
export function safeThemeSlot(slot: string | null | undefined): string | undefined {
  if (!slot) return undefined;
  return THEME_SLOTS.has(String(slot)) ? String(slot) : undefined;
}

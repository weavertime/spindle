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

// Single source of truth for the docs: the markdown in the repo-root
// `documentation/` folder is pulled in raw and lazy-loaded, so it splits into
// its own chunk and never bloats the marketing shell.
const rawDocs = import.meta.glob('../../../documentation/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

// Map each file to a slug = its path under documentation/ without `.md`.
// README.md becomes the docs index (empty slug → /docs).
export const docLoaders: Record<string, () => Promise<string>> = {};
for (const [path, loader] of Object.entries(rawDocs)) {
  const rel = path.replace(/^.*\/documentation\//, '').replace(/\.md$/, '');
  docLoaders[rel === 'README' ? '' : rel] = loader;
}

export const hasDoc = (slug: string): boolean => slug in docLoaders;

export interface DocEntry {
  slug: string;
  title: string;
}
export interface DocGroup {
  label: string;
  items: DocEntry[];
}

// Ordered sidebar. Titles are curated here rather than scraped from the H1 so
// the nav reads consistently. TODO.md is intentionally left out.
export const NAV: DocGroup[] = [
  {
    label: 'Getting Started',
    items: [{ slug: '', title: 'Introduction' }],
  },
  {
    label: 'Documents',
    items: [
      { slug: 'docs/overview', title: 'Overview' },
      { slug: 'docs/architecture', title: 'Architecture' },
      { slug: 'docs/components', title: 'Components' },
      { slug: 'docs/data-structures', title: 'Data Structures' },
    ],
  },
  {
    label: 'Sheets',
    items: [
      { slug: 'sheets/overview', title: 'Overview' },
      { slug: 'sheets/core/architecture', title: 'Architecture' },
      { slug: 'sheets/core/rendering', title: 'Rendering' },
      { slug: 'sheets/core/formulas', title: 'Formula Engine' },
      { slug: 'sheets/core/features', title: 'Features' },
      { slug: 'sheets/components', title: 'Components' },
      { slug: 'sheets/data-structures', title: 'Data Structures' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { slug: 'collaboration', title: 'Real-time Collaboration' },
      { slug: 'comments', title: 'Comments' },
      { slug: 'sheets/contributing/extending', title: 'Extending Spindle' },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items);

export const titleFor = (slug: string): string =>
  ALL.find((e) => e.slug === slug)?.title ?? 'Documentation';

// Previous/next walk order for footer pager.
export const ORDER = ALL.map((e) => e.slug);

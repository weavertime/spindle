// Built-in themes and layouts. Layout ids are stable strings referenced by
// Slide.layoutRef; theme is stored by value on the deck (a copy of one of
// these, so edits don't mutate the shared constant).

import type { ThemeData, LayoutData } from './types';

/** 16:9 at 96 DPI — matches docs-core's DPI convention. */
export const DEFAULT_SLIDE_SIZE = { w: 1280, h: 720 } as const;

const CLEAN: ThemeData = {
  name: 'Clean',
  colors: {
    dk1: '#1F2933',
    lt1: '#FFFFFF',
    dk2: '#3E4C59',
    lt2: '#F5F7FA',
    accent1: '#2D7FF9',
    accent2: '#16B1A6',
    accent3: '#F5A623',
    accent4: '#E8543F',
    accent5: '#8C54FF',
    accent6: '#4CAF50',
    hlink: '#2D7FF9',
    folHlink: '#8C54FF',
  },
  fonts: { major: 'Inter, Arial, sans-serif', minor: 'Inter, Arial, sans-serif' },
};

const CORAL: ThemeData = {
  name: 'Coral',
  colors: {
    dk1: '#2B2118',
    lt1: '#FFFDFB',
    dk2: '#5A4636',
    lt2: '#FBF1EA',
    accent1: '#FF6B6B',
    accent2: '#FF9F45',
    accent3: '#FFD166',
    accent4: '#C1476B',
    accent5: '#6D597A',
    accent6: '#3AA0A0',
    hlink: '#C1476B',
    folHlink: '#6D597A',
  },
  fonts: { major: 'Georgia, "Times New Roman", serif', minor: 'Inter, Arial, sans-serif' },
};

const FOREST: ThemeData = {
  name: 'Forest',
  colors: {
    dk1: '#14241B',
    lt1: '#FFFFFF',
    dk2: '#2F4A39',
    lt2: '#EEF4EF',
    accent1: '#2E8B57',
    accent2: '#3CB371',
    accent3: '#8FBC4B',
    accent4: '#C9A227',
    accent5: '#5B8266',
    accent6: '#1F6E5A',
    hlink: '#2E8B57',
    folHlink: '#1F6E5A',
  },
  fonts: { major: '"Trebuchet MS", Arial, sans-serif', minor: 'Inter, Arial, sans-serif' },
};

export const BUILTIN_THEMES: readonly ThemeData[] = [CLEAN, CORAL, FOREST];

/** Return a fresh copy of a built-in theme by name (defaults to the first). */
export function getBuiltinTheme(name?: string): ThemeData {
  const found = BUILTIN_THEMES.find((t) => t.name === name) ?? CLEAN;
  return { name: found.name, colors: { ...found.colors }, fonts: { ...found.fonts } };
}

// ── Layouts ──────────────────────────────────────────────────────────────────

const titleStyle = { font: 'major', fontSize: 44, bold: true } as const;
const bodyStyle = { font: 'minor', fontSize: 20 } as const;
const subtitleStyle = {
  font: 'minor',
  fontSize: 24,
  color: { kind: 'theme', slot: 'dk2' as const },
} as const;

export const BUILTIN_LAYOUTS: readonly LayoutData[] = [
  {
    id: 'title',
    name: 'Title Slide',
    placeholders: [
      {
        type: 'centerTitle',
        idx: 0,
        frame: { x: 160, y: 250, w: 960, h: 150, rotation: 0 },
        prompt: 'Click to add title',
        style: { ...titleStyle, fontSize: 54, align: 'center', vAlign: 'bottom' },
      },
      {
        type: 'subtitle',
        idx: 1,
        frame: { x: 160, y: 410, w: 960, h: 80, rotation: 0 },
        prompt: 'Click to add subtitle',
        style: { ...subtitleStyle, align: 'center', vAlign: 'top' },
      },
    ],
  },
  {
    id: 'titleContent',
    name: 'Title and Content',
    placeholders: [
      {
        type: 'title',
        idx: 0,
        frame: { x: 80, y: 48, w: 1120, h: 110, rotation: 0 },
        prompt: 'Click to add title',
        style: { ...titleStyle, vAlign: 'middle' },
      },
      {
        type: 'body',
        idx: 1,
        frame: { x: 80, y: 190, w: 1120, h: 482, rotation: 0 },
        prompt: 'Click to add text',
        style: { ...bodyStyle, vAlign: 'top' },
      },
    ],
  },
  {
    id: 'section',
    name: 'Section Header',
    placeholders: [
      {
        type: 'title',
        idx: 0,
        frame: { x: 100, y: 280, w: 1080, h: 120, rotation: 0 },
        prompt: 'Section title',
        style: { ...titleStyle, align: 'left', vAlign: 'bottom' },
      },
      {
        type: 'subtitle',
        idx: 1,
        frame: { x: 100, y: 410, w: 1080, h: 80, rotation: 0 },
        prompt: 'Click to add text',
        style: { ...subtitleStyle, align: 'left', vAlign: 'top' },
      },
    ],
  },
  {
    id: 'twoContent',
    name: 'Two Content',
    placeholders: [
      {
        type: 'title',
        idx: 0,
        frame: { x: 80, y: 48, w: 1120, h: 110, rotation: 0 },
        prompt: 'Click to add title',
        style: { ...titleStyle, vAlign: 'middle' },
      },
      {
        type: 'body',
        idx: 1,
        frame: { x: 80, y: 190, w: 540, h: 482, rotation: 0 },
        prompt: 'Click to add text',
        style: { ...bodyStyle, vAlign: 'top' },
      },
      {
        type: 'body',
        idx: 2,
        frame: { x: 660, y: 190, w: 540, h: 482, rotation: 0 },
        prompt: 'Click to add text',
        style: { ...bodyStyle, vAlign: 'top' },
      },
    ],
  },
  {
    id: 'blank',
    name: 'Blank',
    placeholders: [],
  },
];

/** Return a built-in layout by id, or undefined. */
export function getBuiltinLayout(id: string): LayoutData | undefined {
  return BUILTIN_LAYOUTS.find((l) => l.id === id);
}

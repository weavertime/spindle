// Deck layer: theme + layout types.
//
// A theme is 12 symbolic color slots + a major/minor font pair. A layout is a
// named set of placeholder definitions (position + default styling) that
// `addSlide({ layoutId })` materializes into real elements.

import type {
  Frame,
  Color,
  Fill,
  ThemeColorSlot,
  PlaceholderType,
  BodyStyle,
} from '../scene/types';
import type { TextAlign } from '../text/model';

export interface ThemeData {
  name: string;
  /** Slot → literal hex, e.g. '#1A1A1A'. */
  colors: Record<ThemeColorSlot, string>;
  fonts: {
    /** Headings font family. */
    major: string;
    /** Body font family. */
    minor: string;
  };
}

/** Default styling applied when a placeholder is materialized into an element. */
export interface PlaceholderStyle {
  color?: Color;
  fontSize?: number;
  bold?: boolean;
  align?: TextAlign;
  vAlign?: BodyStyle['vAlign'];
  /** 'major' | 'minor' | a literal family. */
  font?: string;
}

export interface PlaceholderDef {
  type: PlaceholderType;
  /** Distinguishes multiple placeholders of the same type on a layout. */
  idx: number;
  frame: Frame;
  /** Prompt text shown when the materialized element is empty. */
  prompt?: string;
  style?: PlaceholderStyle;
}

export interface LayoutData {
  id: string;
  name: string;
  background?: Fill;
  placeholders: PlaceholderDef[];
}

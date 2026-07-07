// Scene layer types — the container-agnostic geometry + element model.
//
// Elements carry a `containerId` (a slide id today; a canvas/board id when a
// future spindle-canvas reuses this layer) but never any camera/viewport
// state. Everything here is plain data: the engine stores immutable records
// and replaces them on mutation so React snapshots version by reference.

import type { RichTextDoc } from '../text/model';

/**
 * A positioned box. `rotation` is in degrees, clockwise, about the box centre.
 * x/y are the top-left of the un-rotated box in slide coordinates (px).
 */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

// ── Theme references ────────────────────────────────────────────────────────

/**
 * The 12 symbolic theme color slots (PPTX-compatible). Elements reference a
 * slot rather than a literal hex, so a theme switch recolors the whole deck.
 */
export type ThemeColorSlot =
  | 'dk1'
  | 'lt1'
  | 'dk2'
  | 'lt2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hlink'
  | 'folHlink';

/**
 * A color is either a reference to a theme slot (with optional PPTX luminance
 * transforms) or a literal RGB. `alpha` is 0–1; omitted means fully opaque.
 */
export type Color =
  | { kind: 'theme'; slot: ThemeColorSlot; alpha?: number; lumMod?: number; lumOff?: number }
  | { kind: 'rgb'; hex: string; alpha?: number };

export type Fill = { kind: 'none' } | { kind: 'solid'; color: Color };

export type StrokeDash = 'solid' | 'dash' | 'dot';

export interface Stroke {
  color: Color;
  width: number;
  dash?: StrokeDash;
}

// ── Placeholder metadata (PPTX fidelity, in the schema from day one) ─────────

export type PlaceholderType =
  | 'title'
  | 'centerTitle'
  | 'subtitle'
  | 'body'
  | 'image';

export interface PlaceholderMeta {
  type: PlaceholderType;
  idx: number;
}

// ── Text body styling (element-level; paragraph/run styling lives in PM) ─────

export interface BodyStyle {
  vAlign?: 'top' | 'middle' | 'bottom';
  /** Uniform inner padding in px (v1). */
  padding?: number;
  /** Wrap text to the box width (default true). */
  wrap?: boolean;
}

// ── Elements ─────────────────────────────────────────────────────────────────

export interface ElementBase extends Frame {
  id: string;
  /** The slide (or, later, board) this element belongs to. */
  containerId: string;
  /** Fractional z-order key — sorted ascending, painted back-to-front. */
  index: string;
  /** Members of the same flat group share a groupId. */
  groupId?: string;
  locked?: boolean;
  /** 0–1; omitted means 1 (fully opaque). */
  opacity?: number;
  /** Present when this element fills a layout placeholder. */
  placeholder?: PlaceholderMeta;
}

/** ~18 built-in shape presets rendered as inline SVG geometry. */
export type ShapePreset =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star5'
  | 'arrowRight'
  | 'arrowLeft'
  | 'chevron'
  | 'parallelogram'
  | 'trapezoid'
  | 'plus'
  | 'heart'
  | 'cloud';

export type ArrowHead = 'none' | 'arrow' | 'triangle' | 'circle';

export interface TextElement extends ElementBase {
  type: 'text';
  richText: RichTextDoc;
  bodyStyle?: BodyStyle;
  fill?: Fill;
  stroke?: Stroke;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  shape: ShapePreset;
  /** Preset-specific adjustment handles, 0–1 (e.g. corner radius). */
  adjustments?: number[];
  flipH?: boolean;
  flipV?: boolean;
  fill: Fill;
  stroke?: Stroke;
  richText?: RichTextDoc;
  bodyStyle?: BodyStyle;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  src: string;
  naturalW: number;
  naturalH: number;
  flipH?: boolean;
  flipV?: boolean;
}

export interface LineElement extends ElementBase {
  type: 'line';
  /** Diagonal orientation flips (a line occupies the box diagonal). */
  flipH?: boolean;
  flipV?: boolean;
  stroke: Stroke;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
}

export type SlideElement = TextElement | ShapeElement | ImageElement | LineElement;
export type ElementType = SlideElement['type'];

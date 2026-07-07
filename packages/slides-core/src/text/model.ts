// Rich-text model — the ProseMirror-JSON shape stored on text-bearing
// elements, plus pure helpers shared by the static renderer, the toolbar's
// idle-formatting path, and tests. Deliberately flat (doc > paragraph+ >
// inline*): PPTX text bodies are flat paragraphs with bullet attrs, not nested
// lists, which keeps static rendering and future PPTX export honest.
//
// This module is pure JSON — it does not import ProseMirror. The live editor
// (Phase 3) builds a PM schema whose serialized form matches these types.

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type ListType = 'none' | 'bullet' | 'number';

export interface ParagraphAttrs {
  align?: TextAlign;
  listType?: ListType;
  /** Indent level, 0–8. */
  indent?: number;
  /** Multiplier on the font's line height, e.g. 1.2. */
  lineHeight?: number;
  /** Space before the paragraph, in px. */
  spaceBefore?: number;
  /** Space after the paragraph, in px. */
  spaceAfter?: number;
}

/**
 * A text mark. `type` is one of the schema mark names (bold, italic,
 * underline, strikethrough, link, textColor, fontFamily, fontSize); `attrs`
 * carries the mark's parameters (e.g. a Color union for textColor). Kept
 * loosely typed here so the JSON model does not depend on the scene layer.
 */
export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextInline {
  type: 'text';
  text: string;
  marks?: RichTextMark[];
}

export interface RichTextParagraph {
  type: 'paragraph';
  attrs?: ParagraphAttrs;
  content?: RichTextInline[];
}

export interface RichTextDoc {
  type: 'doc';
  content: RichTextParagraph[];
}

/** An empty text body — a single empty paragraph (a valid PM doc). */
export function emptyRichText(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** Build a text body from plain text; each line becomes a paragraph. */
export function richTextFromPlainText(text: string, attrs?: ParagraphAttrs): RichTextDoc {
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      ...(attrs ? { attrs } : {}),
      ...(line.length > 0 ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  };
}

/** Flatten a text body to plain text; paragraphs join with newlines. */
export function richTextToPlainText(doc: RichTextDoc): string {
  return doc.content
    .map((p) => (p.content ?? []).map((inline) => inline.text).join(''))
    .join('\n');
}

/** True when the body has no visible characters (used to show placeholder prompts). */
export function isRichTextEmpty(doc: RichTextDoc): boolean {
  return richTextToPlainText(doc).trim().length === 0;
}

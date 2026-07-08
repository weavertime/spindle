// The ProseMirror schema for slide text bodies. Deliberately flat —
// doc > paragraph+ > inline* — because PPTX text bodies are flat paragraphs
// with bullet attrs, not nested lists. The schema's serialized JSON is exactly
// the RichTextDoc shape in model.ts, so the live editor and the static
// renderer agree.
//
// Marks that carry a theme-aware Color (textColor) or a symbolic font
// (fontFamily 'major'/'minor') store the symbolic value in attrs; toDOM does a
// best-effort literal render for the editor (theme resolution happens in the
// static renderer, which has the theme). Editing a theme-colored run therefore
// shows a fallback color, by design.

import { Schema } from 'prosemirror-model';
import type { Color } from '../scene/types';

export const slidesSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      attrs: {
        align: { default: 'left' },
        listType: { default: 'none' },
        indent: { default: 0 },
        lineHeight: { default: null },
        spaceBefore: { default: 0 },
        spaceAfter: { default: 0 },
      },
      parseDOM: [{ tag: 'p' }],
      toDOM(node) {
        const a = node.attrs;
        const indent = (a.indent as number) || 0;
        const isList = a.listType && a.listType !== 'none';
        // List items reserve a left gutter for the marker (drawn by the editor
        // stylesheet's ::before, since the flat schema has no list nodes).
        const padLeft = isList ? (indent + 1) * 28 : indent * 28;
        const style =
          `text-align:${a.align};position:relative;` +
          // Always emit line-height (default 1.2) so it matches StaticRichText —
          // otherwise the editor inherits the browser's `normal` and the text
          // shifts a hair when entering/leaving edit.
          `line-height:${a.lineHeight || 1.2};` +
          (a.spaceBefore ? `margin-top:${a.spaceBefore}px;` : '') +
          (a.spaceAfter ? `margin-bottom:${a.spaceAfter}px;` : '') +
          (padLeft ? `padding-left:${padLeft}px;` : '');
        return ['p', { style, 'data-list': a.listType }, 0];
      },
    },
    text: { group: 'inline' },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM: () => ['strong', 0],
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: () => ['span', { style: 'text-decoration:underline' }, 0],
    },
    strikethrough: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
      toDOM: () => ['span', { style: 'text-decoration:line-through' }, 0],
    },
    link: {
      attrs: { href: { default: '' } },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs: (dom) => ({ href: (dom as HTMLElement).getAttribute('href') }) }],
      toDOM: (mark) => ['a', { href: mark.attrs.href as string, rel: 'noreferrer', target: '_blank' }, 0],
    },
    textColor: {
      attrs: { color: { default: null } },
      parseDOM: [{ style: 'color', getAttrs: (v) => ({ color: { kind: 'rgb', hex: v as string } }) }],
      toDOM: (mark) => {
        const c = mark.attrs.color as Color | null;
        const css = c && c.kind === 'rgb' ? c.hex : undefined;
        return ['span', css ? { style: `color:${css}` } : {}, 0];
      },
    },
    fontFamily: {
      attrs: { family: { default: 'minor' } },
      parseDOM: [{ style: 'font-family', getAttrs: (v) => ({ family: v as string }) }],
      toDOM: (mark) => {
        const fam = mark.attrs.family as string;
        const literal = fam === 'major' || fam === 'minor' ? undefined : fam;
        return ['span', literal ? { style: `font-family:${literal}` } : {}, 0];
      },
    },
    fontSize: {
      attrs: { size: { default: 18 } },
      parseDOM: [{ style: 'font-size', getAttrs: (v) => ({ size: parseInt(v as string, 10) || 18 }) }],
      toDOM: (mark) => ['span', { style: `font-size:${mark.attrs.size}px` }, 0],
    },
  },
});

// StaticRichText — renders a RichTextDoc as plain React nodes for idle (not
// being edited) text. Memoized on (doc, theme): a theme switch recolors theme
// slot marks with no data migration. The live ProseMirror editor (Phase 3)
// swaps in only on the actively-edited element.

import React from 'react';
import {
  resolveColor,
  resolveFont,
  type RichTextDoc,
  type RichTextParagraph,
  type RichTextInline,
  type ThemeData,
  type Color,
} from '@weavertime/spindle-slides-core';

const INDENT_PX = 28;

function inlineStyle(inline: RichTextInline, theme: ThemeData): { style: React.CSSProperties; href?: string } {
  const style: React.CSSProperties = {};
  const decorations: string[] = [];
  let href: string | undefined;

  for (const mark of inline.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        style.fontWeight = 700;
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'underline':
        decorations.push('underline');
        break;
      case 'strikethrough':
        decorations.push('line-through');
        break;
      case 'textColor':
        if (mark.attrs?.color) style.color = resolveColor(mark.attrs.color as Color, theme);
        break;
      case 'fontFamily':
        style.fontFamily = resolveFont(mark.attrs?.family as string | undefined, theme);
        break;
      case 'fontSize':
        if (typeof mark.attrs?.size === 'number') style.fontSize = `${mark.attrs.size}px`;
        break;
      case 'link':
        href = mark.attrs?.href as string | undefined;
        if (!style.color) style.color = resolveColor({ kind: 'theme', slot: 'hlink' }, theme);
        decorations.push('underline');
        break;
    }
  }
  if (decorations.length) style.textDecoration = decorations.join(' ');
  return { style, href };
}

function renderInline(inline: RichTextInline, theme: ThemeData, key: number): React.ReactNode {
  const { style, href } = inlineStyle(inline, theme);
  const span = (
    <span key={key} style={style}>
      {inline.text}
    </span>
  );
  if (href) {
    return (
      <a key={key} href={href} style={style} target="_blank" rel="noreferrer">
        {inline.text}
      </a>
    );
  }
  return span;
}

function renderParagraph(
  p: RichTextParagraph,
  theme: ThemeData,
  key: number,
  ordinal: number
): React.ReactNode {
  const attrs = p.attrs ?? {};
  const indent = attrs.indent ?? 0;
  const style: React.CSSProperties = {
    textAlign: attrs.align ?? 'left',
    lineHeight: attrs.lineHeight ?? 1.2,
    marginTop: attrs.spaceBefore ?? 0,
    marginBottom: attrs.spaceAfter ?? 0,
    paddingLeft: indent * INDENT_PX,
  };

  const inlines = (p.content ?? []).map((inline, i) => renderInline(inline, theme, i));
  const body = inlines.length ? inlines : <br />;

  const listType = attrs.listType ?? 'none';
  if (listType === 'none') {
    return (
      <div key={key} style={style}>
        {body}
      </div>
    );
  }

  // Mirror the live editor's list layout (schema toDOM + editor stylesheet):
  // a (indent+1)*INDENT_PX gutter with the marker hanging in it, so there's no
  // indent jump when entering/leaving edit mode.
  const marker = listType === 'bullet' ? '•' : `${ordinal}.`;
  return (
    <div key={key} style={{ ...style, position: 'relative', paddingLeft: (indent + 1) * INDENT_PX }}>
      <span style={{ position: 'absolute', left: listType === 'bullet' ? 8 : 2, opacity: 0.9 }}>{marker}</span>
      {body}
    </div>
  );
}

export interface StaticRichTextProps {
  doc: RichTextDoc;
  theme: ThemeData;
}

function StaticRichTextImpl({ doc, theme }: StaticRichTextProps): React.ReactElement {
  // Running counter for ordered lists — resets whenever a paragraph is not a
  // numbered item at the same nesting level.
  let counter = 0;
  const children = doc.content.map((p, i) => {
    const attrs = p.attrs ?? {};
    if ((attrs.listType ?? 'none') === 'number') counter += 1;
    else counter = 0;
    return renderParagraph(p, theme, i, counter);
  });
  return <>{children}</>;
}

export const StaticRichText = React.memo(StaticRichTextImpl);

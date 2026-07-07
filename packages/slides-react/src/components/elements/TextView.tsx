import React from 'react';
import { resolveColor, resolveFill, isRichTextEmpty, type TextElement, type ThemeData } from '@weavertime/spindle-slides-core';
import { StaticRichText } from './StaticRichText';
import { RichTextEditor } from '../RichTextEditor';
import { useEditingId } from '../../hooks';
import { strokeAttrs } from './style';

const V_ALIGN: Record<NonNullable<TextElement['bodyStyle']>['vAlign'] & string, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

export function TextView({ el, theme }: { el: TextElement; theme: ThemeData }): React.ReactElement {
  const body = el.bodyStyle ?? {};
  const bg = el.fill ? resolveFill(el.fill, theme) : null;
  const border = strokeAttrs(el.stroke, theme);
  const editing = useEditingId() === el.id;

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    ...(bg ? { background: bg } : {}),
    ...(border ? { border: `${border.strokeWidth}px solid ${border.stroke}` } : {}),
  };

  const inner: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: body.padding ?? 8,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: V_ALIGN[body.vAlign ?? 'top'],
    fontFamily: theme.fonts.minor,
    fontSize: 18,
    color: resolveColor({ kind: 'theme', slot: 'dk1' }, theme),
    whiteSpace: body.wrap === false ? 'nowrap' : 'normal',
  };

  return (
    <div style={container}>
      {editing ? (
        <RichTextEditor elementId={el.id} theme={theme} bodyStyle={body} />
      ) : (
        <div style={inner}>
          {isRichTextEmpty(el.richText) ? null : <StaticRichText doc={el.richText} theme={theme} />}
        </div>
      )}
    </div>
  );
}

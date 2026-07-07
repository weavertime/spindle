import React from 'react';
import { resolveColor, resolveFill, type TextElement, type ThemeData } from '@weavertime/spindle-slides-core';
import { StaticRichText } from './StaticRichText';
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

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: body.padding ?? 8,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: V_ALIGN[body.vAlign ?? 'top'],
    overflow: 'hidden',
    fontFamily: theme.fonts.minor,
    fontSize: 18,
    color: resolveColor({ kind: 'theme', slot: 'dk1' }, theme),
    whiteSpace: body.wrap === false ? 'nowrap' : 'normal',
    ...(bg ? { background: bg } : {}),
    ...(border ? { border: `${border.strokeWidth}px solid ${border.stroke}` } : {}),
  };

  return (
    <div style={style}>
      <StaticRichText doc={el.richText} theme={theme} />
    </div>
  );
}

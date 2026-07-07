import React from 'react';
import { resolveColor, type LineElement, type ArrowHead, type ThemeData } from '@weavertime/spindle-slides-core';
import { strokeAttrs } from './style';

function ArrowMarker({ id, head, color, place }: { id: string; head: ArrowHead; color: string; place: 'start' | 'end' }): React.ReactElement | null {
  if (head === 'none') return null;
  // Marker drawn pointing right (+x); orient='auto' rotates it to the line.
  const path =
    head === 'triangle'
      ? 'M0 0 L10 5 L0 10 Z'
      : head === 'arrow'
        ? 'M0 0 L10 5 L0 10'
        : null;
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={place === 'end' ? 9 : 1}
      refY={5}
      markerWidth={7}
      markerHeight={7}
      orient="auto-start-reverse"
    >
      {head === 'circle' ? (
        <circle cx={5} cy={5} r={4} fill={color} />
      ) : (
        <path d={path!} fill={head === 'triangle' ? color : 'none'} stroke={color} strokeWidth={1.5} />
      )}
    </marker>
  );
}

export function LineView({ el, theme }: { el: LineElement; theme: ThemeData }): React.ReactElement {
  const w = Math.max(1, el.w);
  const h = Math.max(1, el.h);
  const stroke = strokeAttrs(el.stroke, theme) ?? {
    stroke: resolveColor(el.stroke.color, theme),
    strokeWidth: Math.max(1, el.stroke.width),
  };

  // Line runs along the box diagonal; flipV picks the other diagonal.
  const [x1, y1, x2, y2] = el.flipV ? [0, h, w, 0] : [0, 0, w, h];

  const startId = `arw-s-${el.id}`;
  const endId = `arw-e-${el.id}`;
  const startHead = el.startArrow ?? 'none';
  const endHead = el.endArrow ?? 'none';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <ArrowMarker id={startId} head={startHead} color={stroke.stroke} place="start" />
        <ArrowMarker id={endId} head={endHead} color={stroke.stroke} place="end" />
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke.stroke}
        strokeWidth={stroke.strokeWidth}
        strokeDasharray={stroke.strokeDasharray}
        strokeLinecap="round"
        markerStart={startHead !== 'none' ? `url(#${startId})` : undefined}
        markerEnd={endHead !== 'none' ? `url(#${endId})` : undefined}
      />
    </svg>
  );
}

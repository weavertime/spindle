// Context that lets a toolbar control know it's being rendered inside the
// ResponsiveToolbar overflow surface, and open a portaled modal for its options
// (a shape grid, colour swatches, a theme list…). Anchored popovers don't work
// inside the portaled surface, so complex controls switch to menu rows + a modal
// here instead. A control that ignores this context just renders normally.

import React, { createContext, useContext } from 'react';

export interface ToolbarMenuApi {
  /** True when the control is inside the overflow surface (menu/sheet). */
  inMenu: boolean;
  /** Open a modal with the control's options; `content` is fully owned by it. */
  openModal: (title: string, content: React.ReactNode) => void;
  /** Close only the modal, returning to the surface. */
  closeModal: () => void;
  /** Close the modal AND the whole surface (call after applying an action). */
  closeMenu: () => void;
}

const noop = (): void => {};
export const ToolbarMenuContext = createContext<ToolbarMenuApi>({
  inMenu: false, openModal: noop, closeModal: noop, closeMenu: noop,
});

export function useToolbarMenu(): ToolbarMenuApi {
  return useContext(ToolbarMenuContext);
}

/** A consistent overflow-menu row: icon + label, optional right-side hint. */
export function MenuRow({
  icon, label, hint, onClick,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <div
      role="menuitem"
      className="sp-rt-menuitem"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 40, padding: '3px 12px 3px 8px', borderRadius: 8, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
    >
      {icon != null && <span style={{ display: 'inline-flex', width: 22, justifyContent: 'center', color: '#475569', flex: '0 0 auto' }}>{icon}</span>}
      <span style={{ fontSize: 14, color: '#334155', whiteSpace: 'nowrap' }}>{label}</span>
      {hint != null && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', color: '#94a3b8', fontSize: 13 }}>{hint}</span>}
    </div>
  );
}

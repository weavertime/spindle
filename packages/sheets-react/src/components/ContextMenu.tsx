import React, { memo, useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onDelete?: () => void;
  onInsertRow?: () => void;
  onInsertRowBelow?: () => void;
  onInsertColumn?: () => void;
  onInsertColumnRight?: () => void;
  onDeleteRow?: () => void;
  onDeleteColumn?: () => void;
  onFormat?: () => void;
  onComment?: () => void;
}

export const ContextMenu = memo(function ContextMenu({
  x,
  y,
  onClose,
  onCopy,
  onPaste,
  onCut,
  onDelete,
  onInsertRow,
  onInsertRowBelow,
  onInsertColumn,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  onFormat,
  onComment,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use a small delay to avoid closing immediately when menu opens
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  const MenuItem = memo(
    ({
      onClick,
      children,
      disabled,
    }: {
      onClick?: () => void;
      children: React.ReactNode;
      disabled?: boolean;
    }) => (
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && onClick) {
            onClick();
          }
        }}
        style={{
          padding: '6px 12px',
          cursor: disabled ? 'default' : 'pointer',
          fontSize: '12px',
          color: disabled ? '#999' : '#333',
          backgroundColor: disabled ? 'transparent' : undefined,
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {children}
      </div>
    )
  );

  MenuItem.displayName = 'ContextMenuItem';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '150px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem onClick={onCopy}>Copy (Ctrl+C)</MenuItem>
      <MenuItem onClick={onPaste} disabled={!onPaste}>
        Paste (Ctrl+V)
      </MenuItem>
      <MenuItem onClick={onCut}>Cut (Ctrl+X)</MenuItem>
      <MenuItem onClick={onDelete}>Delete</MenuItem>
      <div
        style={{
          height: '1px',
          backgroundColor: '#e0e0e0',
          margin: '4px 0',
        }}
      />
      <MenuItem onClick={onInsertRow}>Insert Row Above</MenuItem>
      <MenuItem onClick={onInsertRowBelow}>Insert Row Below</MenuItem>
      <MenuItem onClick={onInsertColumn}>Insert Column Left</MenuItem>
      <MenuItem onClick={onInsertColumnRight}>Insert Column Right</MenuItem>
      <MenuItem onClick={onDeleteRow}>Delete Row</MenuItem>
      <MenuItem onClick={onDeleteColumn}>Delete Column</MenuItem>
      <div
        style={{
          height: '1px',
          backgroundColor: '#e0e0e0',
          margin: '4px 0',
        }}
      />
      <MenuItem onClick={onFormat}>Format Cells...</MenuItem>
      <div
        style={{
          height: '1px',
          backgroundColor: '#e0e0e0',
          margin: '4px 0',
        }}
      />
      <MenuItem onClick={onComment}>Comment</MenuItem>
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';
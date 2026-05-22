import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { useWorkbook } from '../context/WorkbookContext';
import { columnIndexToLabel } from '@pagent-libs/sheets-core';

interface FormulaBarProps {
  activeCell: { row: number; col: number } | null;
  onFormulaChange?: (formula: string) => void;
}

export const FormulaBar = memo(function FormulaBar({
  activeCell,
  onFormulaChange,
}: FormulaBarProps) {
  const { workbook } = useWorkbook();
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when active cell changes
  useEffect(() => {
    if (!activeCell) {
      setInputValue('');
      setIsEditing(false);
      return;
    }

    if (!isEditing) {
      const anchor = workbook.getSpillAnchor(undefined, activeCell.row, activeCell.col);
      const spilledNonAnchor =
        anchor !== undefined && (anchor.row !== activeCell.row || anchor.col !== activeCell.col);
      if (spilledNonAnchor) {
        // A spilled cell shows the anchor's formula, read-only.
        const anchorCell = workbook.getCell(undefined, anchor.row, anchor.col);
        setInputValue(anchorCell?.formula || '');
        setReadOnly(true);
      } else {
        const cell = workbook.getCell(undefined, activeCell.row, activeCell.col);
        setInputValue(cell?.formula || cell?.value?.toString() || '');
        setReadOnly(false);
      }
    }
  }, [activeCell, workbook, isEditing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsEditing(true);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    if (activeCell && onFormulaChange && !readOnly) {
      onFormulaChange(inputValue);
    }
  }, [activeCell, inputValue, onFormulaChange, readOnly]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        if (activeCell) {
          const cell = workbook.getCell(undefined, activeCell.row, activeCell.col);
          setInputValue(cell?.formula || cell?.value?.toString() || '');
        }
      }
    },
    [activeCell, workbook]
  );

  const cellReference = activeCell
    ? `${columnIndexToLabel(activeCell.col)}${activeCell.row + 1}`
    : '';

  return (
    <div
      className="formula-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        backgroundColor: 'transparent',
        padding: '0 14px',
        gap: '8px',
        fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        className="cell-reference"
        style={{
          minWidth: '72px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#475569',
          textAlign: 'center',
          padding: '5px 10px',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          border: '1px solid rgba(15, 23, 42, 0.1)',
          borderRadius: '8px',
        }}
      >
        {cellReference}
      </div>
      <div
        className="formula-input-container"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          border: '1px solid rgba(15, 23, 42, 0.1)',
          borderRadius: '8px',
          padding: '0 10px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            color: '#94a3b8',
            marginRight: '6px',
            fontWeight: 500,
          }}
        >
          =
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly={readOnly}
          onChange={handleInputChange}
          onFocus={(e) => {
            handleInputFocus();
            const parent = e.currentTarget.parentElement!;
            parent.style.borderColor = '#6366f1';
            parent.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.12)';
          }}
          onBlur={(e) => {
            handleInputBlur();
            const parent = e.currentTarget.parentElement!;
            parent.style.borderColor = 'rgba(15, 23, 42, 0.1)';
            parent.style.boxShadow = 'none';
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Enter formula or value"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            padding: '4px 0',
            backgroundColor: 'transparent',
            color: readOnly ? '#94a3b8' : '#1e293b',
            fontStyle: readOnly ? 'italic' : 'normal',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
});


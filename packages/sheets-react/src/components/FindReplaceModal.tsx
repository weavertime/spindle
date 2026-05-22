import React, { memo, useEffect, useRef } from 'react';

export interface FindReplaceState {
  query: string;
  replacement: string;
  matchCase: boolean;
  wholeCell: boolean;
  searchFormulas: boolean;
}

interface FindReplaceModalProps {
  query: string;
  replacement: string;
  matchCase: boolean;
  wholeCell: boolean;
  searchFormulas: boolean;
  matchCount: number;
  /** Index of the currently highlighted match, or -1 when none is active. */
  activeMatchIndex: number;
  onChange: (patch: Partial<FindReplaceState>) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

/**
 * A floating Find & Replace panel. Deliberately not a blocking modal — the
 * grid stays visible behind it so the user can see matches being selected.
 */
export const FindReplaceModal = memo(function FindReplaceModal({
  query,
  replacement,
  matchCase,
  wholeCell,
  searchFormulas,
  matchCount,
  activeMatchIndex,
  onChange,
  onFindNext,
  onFindPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplaceModalProps) {
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onFindPrev();
      else onFindNext();
    }
  };

  let counterText = '';
  if (query) {
    if (matchCount === 0) counterText = 'No results';
    else if (activeMatchIndex >= 0) counterText = `${activeMatchIndex + 1} of ${matchCount}`;
    else counterText = `${matchCount} found`;
  }

  return (
    <div style={panelStyle} onKeyDown={handleKeyDown}>
      <div style={headerStyle}>
        <span style={titleStyle}>Find and replace</span>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
          ×
        </button>
      </div>

      <div style={fieldStyle}>
        <input
          ref={findInputRef}
          type="text"
          value={query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Find"
          style={inputStyle}
        />
        <span style={counterStyle}>{counterText}</span>
      </div>

      <div style={fieldStyle}>
        <input
          type="text"
          value={replacement}
          onChange={(e) => onChange({ replacement: e.target.value })}
          placeholder="Replace with"
          style={inputStyle}
        />
      </div>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(e) => onChange({ matchCase: e.target.checked })}
        />
        Match case
      </label>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={wholeCell}
          onChange={(e) => onChange({ wholeCell: e.target.checked })}
        />
        Match entire cell contents
      </label>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={searchFormulas}
          onChange={(e) => onChange({ searchFormulas: e.target.checked })}
        />
        Search within formulas
      </label>

      <div style={buttonRowStyle}>
        <button
          type="button"
          onClick={onFindPrev}
          disabled={matchCount === 0}
          style={secondaryButtonStyle}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onFindNext}
          disabled={matchCount === 0}
          style={secondaryButtonStyle}
        >
          Next
        </button>
        <button
          type="button"
          onClick={onReplace}
          disabled={matchCount === 0}
          style={secondaryButtonStyle}
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onReplaceAll}
          disabled={matchCount === 0}
          style={primaryButtonStyle}
        >
          Replace all
        </button>
      </div>
    </div>
  );
});

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '70px',
  right: '24px',
  zIndex: 10000,
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  padding: '16px',
  width: '320px',
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 500,
  color: '#202124',
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '20px',
  lineHeight: 1,
  color: '#5f6368',
  cursor: 'pointer',
  padding: '0 4px',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  border: '1px solid #e8eaed',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const counterStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#5f6368',
  whiteSpace: 'nowrap',
  minWidth: '64px',
  textAlign: 'right',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#202124',
  marginBottom: '6px',
  cursor: 'pointer',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  marginTop: '12px',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #e8eaed',
  borderRadius: '4px',
  backgroundColor: '#ffffff',
  color: '#5f6368',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#1a73e8',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
};

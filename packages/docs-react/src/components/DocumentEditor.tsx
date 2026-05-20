/**
 * DocumentEditor - Main document editor component
 * 
 * This component provides a Google Docs-like editing experience using a single
 * ProseMirror instance architecture with a true layout engine.
 * 
 * Architecture:
 * - Single hidden ProseMirror instance handles all editing
 * - Separate visual rendering layer displays paginated content
 * - InputBridge forwards keyboard events from visible surface to hidden editor
 * - SelectionOverlay renders caret and selection as a separate layer
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { PageConfig, PageMargins, Block, HeaderFooterContent } from '@pagent-libs/docs-core';
import { activeMarksPluginKey } from '@pagent-libs/docs-core';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useDocument, useSections } from '../context/DocumentContext';
import { Toolbar } from './Toolbar';
import { Ruler } from './Ruler';
import { VerticalRuler } from './VerticalRuler';
import { PageSetupModal } from './PageSetupModal';
import { TrueLayoutEditor, CellSelection, ActivePageInfo, TrueLayoutEditorHandle } from '../core';
import type { ActiveMarks } from './ProseMirrorEditor';

interface DocumentEditorProps {
  width?: number;
  height?: number;
  showToolbar?: boolean;
  showRuler?: boolean;
}

const defaultActiveMarks: ActiveMarks = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  superscript: false,
  subscript: false,
  link: null,
  textStyle: null,
  blockType: 'paragraph',
  headingLevel: 1,
  listType: null,
  alignment: 'left',
};

/**
 * Main document editor component.
 * 
 * Uses a single ProseMirror instance for the entire document:
 * - Better performance for large documents
 * - Unified undo/redo history
 * - Simpler toolbar integration
 * - Proper selection handling across blocks
 */
export const DocumentEditor = memo(function DocumentEditor({
  width,
  height,
  showToolbar = true,
  showRuler = true,
}: DocumentEditorProps) {
  const { document: docModel, zoom } = useDocument();
  const sections = useSections();
  
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [activeMarks, setActiveMarks] = useState<ActiveMarks>(defaultActiveMarks);
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [activePageInfo, setActivePageInfo] = useState<ActivePageInfo | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TrueLayoutEditorHandle>(null);
  
  // Get the first section's page config for the ruler
  const currentPageConfig = sections[0]?.pageConfig || docModel.getDefaultPageConfig();
  const initialBlocks = sections[0]?.blocks || [];
  
  // Get header/footer from the document model (first section)
  const header = sections[0]?.header;
  const footer = sections[0]?.footer;
  const documentTitle = docModel.getTitle();
  
  // Handle header changes - update document model
  const handleHeaderChange = useCallback((content: HeaderFooterContent) => {
    if (sections[0]) {
      docModel.setSectionHeader(sections[0].id, content);
      docModel.recordHistory('Update header');
    }
  }, [docModel, sections]);
  
  // Handle footer changes - update document model
  const handleFooterChange = useCallback((content: HeaderFooterContent) => {
    if (sections[0]) {
      docModel.setSectionFooter(sections[0].id, content);
      docModel.recordHistory('Update footer');
    }
  }, [docModel, sections]);
  
  // Handle margins change from ruler
  const handleMarginsChange = useCallback((margins: PageMargins) => {
    if (sections[0]) {
      docModel.setSectionPageConfig(sections[0].id, {
        ...sections[0].pageConfig,
        margins,
      });
      docModel.recordHistory('Update margins');
    }
  }, [docModel, sections]);
  
  // Handle page setup confirmation
  const handlePageSetupConfirm = useCallback((config: PageConfig) => {
    if (sections[0]) {
      docModel.setSectionPageConfig(sections[0].id, config);
      docModel.recordHistory('Update page setup');
    }
    docModel.setDefaultPageConfig(config);
  }, [docModel, sections]);
  
  // Handle document changes from PresentationEditor
  const handleDocChange = useCallback((blocks: Block[]) => {
    if (sections[0]) {
      docModel.setSectionBlocks(sections[0].id, blocks);
      docModel.recordHistory('Edit content');
    }
  }, [docModel, sections]);
  
  // Handle selection changes from PresentationEditor
  const handleSelectionChange = useCallback((state: EditorState) => {
    const marks = activeMarksPluginKey.getState(state) as ActiveMarks | undefined;
    if (marks) {
      setActiveMarks(marks);
    }
  }, []);
  
  // Handle editor ready
  const handleEditorReady = useCallback((view: EditorView) => {
    setEditorView(view);
    
    // Get initial active marks
    const marks = activeMarksPluginKey.getState(view.state) as ActiveMarks | undefined;
    if (marks) {
      setActiveMarks(marks);
    }
    
    // Get scroll container for vertical ruler
    setTimeout(() => {
      if (editorRef.current) {
        setScrollContainer(editorRef.current.getScrollContainer());
      }
    }, 0);
  }, []);
  
  // Handle cell selection changes
  const handleCellSelectionChange = useCallback((selection: CellSelection | null) => {
    setSelectedCell(selection);
  }, []);
  
  // Handle active page changes
  const handleActivePageChange = useCallback((info: ActivePageInfo) => {
    setActivePageInfo(info);
  }, []);
  
  // Keyboard shortcuts for document-level undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          docModel.redo();
        } else {
          docModel.undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        docModel.redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docModel]);
  
  // Convert PageConfig to the format expected by TrueLayoutEditor
  // When orientation is landscape, swap width and height
  // Memoize to prevent unnecessary re-renders of TrueLayoutEditor
  // Note: We list individual margin properties to ensure proper reactivity
  const presentationPageConfig = useMemo(() => ({
    width: currentPageConfig.orientation === 'landscape' 
      ? currentPageConfig.size.h 
      : currentPageConfig.size.w,
    height: currentPageConfig.orientation === 'landscape' 
      ? currentPageConfig.size.w 
      : currentPageConfig.size.h,
    margins: currentPageConfig.margins,
  }), [
    currentPageConfig.orientation,
    currentPageConfig.size.w,
    currentPageConfig.size.h,
    currentPageConfig.margins.top,
    currentPageConfig.margins.bottom,
    currentPageConfig.margins.left,
    currentPageConfig.margins.right,
    currentPageConfig.margins.header,
    currentPageConfig.margins.footer,
  ]);
  
  return (
    <div
      ref={containerRef}
      className="document-editor"
      style={{
        width: width || '100%',
        height: height || '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      {/* Floating Toolbar */}
      {showToolbar && (
        <div style={{ 
          position: 'relative', 
          zIndex: 200, 
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 16px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        }}>
          <Toolbar 
            onPageSetup={() => setShowPageSetup(true)}
            editorView={editorView}
            activeMarks={activeMarks}
            selectedCell={selectedCell}
          />
        </div>
      )}
      
      {/* Ruler container */}
      {showRuler && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e8eaed',
            padding: '8px 0',
          }}
        >
          <Ruler
            pageConfig={currentPageConfig}
            onMarginsChange={handleMarginsChange}
          />
        </div>
      )}
      
      {/* Editor area with vertical ruler */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Vertical Ruler - positioned to the left */}
        {showRuler && activePageInfo && scrollContainer && (
          <div
            style={{
              position: 'relative',
              width: 24 * (zoom / 100),
              flexShrink: 0,
              backgroundColor: '#f8f9fa',
              borderRight: '1px solid #e8eaed',
              overflow: 'hidden',
            }}
          >
            <VerticalRuler
              pageConfig={currentPageConfig}
              onMarginsChange={handleMarginsChange}
              pageIndex={activePageInfo.pageIndex}
              pageHeight={activePageInfo.pageHeight}
              pageGap={24}
              scrollContainerRef={{ current: scrollContainer }}
            />
          </div>
        )}
        
        {/* Editor - using TrueLayoutEditor (line-level pagination) */}
        <TrueLayoutEditor
          ref={editorRef}
          initialBlocks={initialBlocks}
          pageConfig={presentationPageConfig}
          zoom={zoom / 100}
          editable={true}
          onDocChange={handleDocChange}
          onSelectionChange={handleSelectionChange}
          onCellSelectionChange={handleCellSelectionChange}
          onActivePageChange={handleActivePageChange}
          onReady={handleEditorReady}
          pageGap={24}
          minLinesAtBreak={2}
          textStylePool={docModel.getTextStylePool()}
          header={header}
          footer={footer}
          documentTitle={documentTitle}
          onHeaderChange={handleHeaderChange}
          onFooterChange={handleFooterChange}
          collabHandle={docModel.getCollabHandle()}
        />
      </div>
      
      {/* Page Setup Modal */}
      <PageSetupModal
        isOpen={showPageSetup}
        pageConfig={currentPageConfig}
        onClose={() => setShowPageSetup(false)}
        onConfirm={handlePageSetupConfirm}
      />
    </div>
  );
});

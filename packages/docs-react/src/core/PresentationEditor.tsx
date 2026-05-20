/**
 * PresentationEditor - Main orchestrator for the single-instance ProseMirror architecture
 * 
 * This component implements a layout engine for vertical pagination:
 * 1. A hidden ProseMirror editor handles all editing
 * 2. A layout engine measures content and calculates page breaks
 * 3. Each page is rendered as a separate container with overflow:hidden
 * 4. Content is clipped at page boundaries using negative margins
 * 
 * This architecture allows for true vertical pagination with proper content clipping.
 */

import {
  memo,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as PmNode } from 'prosemirror-model';
import { blocksToPmDoc, proseMirrorToDocument, Block, DEFAULT_PAGE_CONFIG } from '@pagent-libs/docs-core';

import { HiddenEditor, HiddenEditorHandle } from './HiddenEditor';
import {
  PageConfig,
  DocumentLayout,
  computeLayout,
  getPositionCoords,
  computeSelectionRects,
} from './LayoutEngine';
import { PageRenderer, SelectionOverlay } from './PageRenderer';

export interface PresentationEditorProps {
  /** Initial blocks to render */
  initialBlocks: Block[];
  /** Page configuration */
  pageConfig: PageConfig;
  /** Zoom level (1 = 100%) */
  zoom?: number;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Called when the document changes */
  onDocChange?: (blocks: Block[]) => void;
  /** Called when selection changes */
  onSelectionChange?: (state: EditorState) => void;
  /** Called when the editor is ready */
  onReady?: (view: EditorView) => void;
  /** Container width */
  width?: number | string;
  /** Container height */
  height?: number | string;
}

// Gap between pages in pixels
const PAGE_GAP = 24;

/**
 * PresentationEditor - The main component
 * 
 * Architecture:
 * - Hidden editor for editing (actually visible but positioned to show on first page)
 * - Layout engine for measuring and pagination
 * - Separate page containers with overflow:hidden for clipping
 */
export const PresentationEditor = memo(function PresentationEditor({
  initialBlocks,
  pageConfig,
  zoom = 1,
  editable = true,
  onDocChange,
  onSelectionChange,
  onReady,
  width = '100%',
  height = '100%',
}: PresentationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const hiddenEditorRef = useRef<HiddenEditorHandle>(null);
  
  // Stable refs to avoid useCallback in useEffect dependencies
  const updateLayoutRef = useRef<(() => void) | null>(null);
  const updateSelectionRef = useRef<((state: EditorState) => void) | null>(null);

  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [currentDoc, setCurrentDoc] = useState<PmNode | null>(null);
  const [layout, setLayout] = useState<DocumentLayout | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [caretPosition, setCaretPosition] = useState<{
    pageIndex: number;
    x: number;
    y: number;
    height: number;
  } | null>(null);
  const [selectionRects, setSelectionRects] = useState<Array<{
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([]);

  // Create initial PM document
  const initialDoc = useMemo(() => {
    return blocksToPmDoc(initialBlocks);
  }, [initialBlocks]);

  // Page dimensions - use Math.floor to avoid sub-pixel rendering issues
  const pageWidth = Math.floor(pageConfig.width * zoom);
  const pageHeight = Math.floor(pageConfig.height * zoom);
  const marginTop = Math.floor(pageConfig.margins.top * zoom);
  const marginBottom = Math.floor(pageConfig.margins.bottom * zoom);
  const marginLeft = Math.floor(pageConfig.margins.left * zoom);
  const marginRight = Math.floor(pageConfig.margins.right * zoom);
  const contentWidth = pageWidth - marginLeft - marginRight;
  const contentHeight = pageHeight - marginTop - marginBottom;

  // Compute layout when document changes
  const updateLayout = useCallback(() => {
    if (!currentDoc || !editorContainerRef.current) return;

    const newLayout = computeLayout(currentDoc, editorContainerRef.current, {
      pageConfig,
      scale: zoom,
    });

    setLayout(newLayout);
  }, [currentDoc, pageConfig, zoom]);
  
  // Keep ref in sync for stable reference in effects
  updateLayoutRef.current = updateLayout;

  // Update selection display
  const updateSelection = useCallback((state: EditorState) => {
    if (!layout || !editorView) return;

    const { selection } = state;
    
    if (selection.empty) {
      // Collapsed selection - show caret
      const coords = getPositionCoords(selection.from, layout, editorView);
      if (coords) {
        setCaretPosition(coords);
      } else {
        setCaretPosition(null);
      }
      setSelectionRects([]);
    } else {
      // Range selection - show selection rectangles
      setCaretPosition(null);
      const rects = computeSelectionRects(selection.from, selection.to, layout, editorView);
      setSelectionRects(rects);
    }
  }, [layout, editorView]);
  
  // Keep ref in sync for stable reference in effects
  updateSelectionRef.current = updateSelection;

  // Handle document changes from the editor
  const handleDocChange = useCallback((doc: PmNode, _state: EditorState) => {
    setCurrentDoc(doc);

    // Notify parent
    if (onDocChange) {
      // Minimal stand-in document — only its blocks are read back.
      const docModel = proseMirrorToDocument(doc, {
        id: '',
        title: '',
        sections: [{ id: 'main', pageConfig: DEFAULT_PAGE_CONFIG, blocks: [] }],
        defaultPageConfig: DEFAULT_PAGE_CONFIG,
      });
      onDocChange(docModel.sections[0].blocks);
    }
  }, [onDocChange]);

  // Handle selection changes
  const handleSelectionChange = useCallback((state: EditorState) => {
    updateSelectionRef.current?.(state);
    onSelectionChange?.(state);
  }, [onSelectionChange]);

  // Handle editor ready
  const handleEditorReady = useCallback((view: EditorView) => {
    setEditorView(view);
    setCurrentDoc(view.state.doc);
    onReady?.(view);
  }, [onReady]);

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Update layout when document changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is updated
    const rafId = requestAnimationFrame(() => {
      updateLayoutRef.current?.();
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentDoc]);

  // Update selection when layout changes
  useEffect(() => {
    if (editorView && layout) {
      updateSelectionRef.current?.(editorView.state);
    }
  }, [layout, editorView]);

  // Prevent any scrolling within the page content area
  // The editor content should never scroll - it flows across pages instead
  // We need to prevent scroll on multiple elements in the hierarchy
  useEffect(() => {
    if (!editorView || !editorContainerRef.current) return;

    const pmElement = editorView.dom;
    const editorContainer = editorContainerRef.current;
    const pageContentArea = editorContainer.closest('.page-content-area');
    const editorWrapper = editorContainer.closest('.editor-wrapper');
    
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.scrollTop !== 0 || target.scrollLeft !== 0)) {
        target.scrollTop = 0;
        target.scrollLeft = 0;
      }
    };

    // Add scroll listeners to all elements in the hierarchy
    const elements = [pmElement, editorContainer, editorWrapper, pageContentArea].filter(Boolean) as HTMLElement[];
    
    elements.forEach(el => {
      el.addEventListener('scroll', preventScroll, { passive: false });
    });

    return () => {
      elements.forEach(el => {
        el.removeEventListener('scroll', preventScroll);
      });
    };
  }, [editorView]);

  // Handle click on pages to focus editor
  const handlePageClick = useCallback((_e: React.MouseEvent) => {
    // Focus the editor when clicking on any page
    if (hiddenEditorRef.current) {
      const view = editorView;
      if (view) {
        view.focus();
      }
    }
  }, [editorView]);

  // Calculate total height
  const pageCount = layout?.pages.length || 1;
  const totalHeight = pageCount * pageHeight + (pageCount - 1) * PAGE_GAP * zoom;

  return (
    <div
      ref={containerRef}
      className="presentation-editor"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Scrollable Viewport - vertical scroll for multiple pages */}
      <div
        ref={viewportRef}
        className="presentation-viewport"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Vertical page stack */}
        <div
          className="presentation-pages-stack"
          style={{
            position: 'relative',
            width: pageWidth,
            height: totalHeight,
            flexShrink: 0,
          }}
          onClick={handlePageClick}
        >
          {/* Render each page */}
          {(layout?.pages || [{ pageIndex: 0, blocks: [], contentHeight: 0, startOffset: 0 }]).map((page, index) => {
            // Use simple offset calculation: each page shows contentHeight worth of content
            const cumulativeOffset = index * contentHeight;
            
            return (
              <div
                key={`page-wrapper-${page.pageIndex}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: page.pageIndex * (pageHeight + PAGE_GAP * zoom),
                }}
              >
                <PageRenderer
                  page={page}
                  pageConfig={pageConfig}
                  scale={zoom}
                  editorContent={index > 0 ? editorContainerRef.current : null}
                  isEditorPage={index === 0}
                  cumulativeOffset={cumulativeOffset}
                >
                  {index === 0 && (
                    <div
                      ref={editorContainerRef}
                      className="editor-container"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      style={{
                        width: contentWidth,
                      }}
                    >
                      <HiddenEditor
                        ref={hiddenEditorRef}
                        initialDoc={initialDoc}
                        contentWidth={contentWidth}
                        editable={editable}
                        hidden={false}
                        onDocChange={handleDocChange}
                        onSelectionChange={handleSelectionChange}
                        onReady={handleEditorReady}
                      />
                    </div>
                  )}
                </PageRenderer>
              </div>
            );
          })}

          {/* Selection overlay - renders caret and selection across all pages */}
          <SelectionOverlay
            caretPosition={caretPosition}
            selectionRects={selectionRects}
            pageConfig={pageConfig}
            scale={zoom}
            isFocused={isFocused}
            pageGap={PAGE_GAP * zoom}
          />
        </div>
      </div>

      {/* ProseMirror editor styles */}
      <style>{`
        .visible-editor-host .ProseMirror {
          outline: none;
          min-height: 100%;
          caret-color: transparent; /* Hide native caret, we render our own */
          /* Prevent the editor from scrolling - we handle scrolling at the viewport level */
          overflow: visible !important;
        }
        .visible-editor-host .ProseMirror:focus {
          /* Prevent browser from scrolling to focused element */
          scroll-margin: 0;
          scroll-padding: 0;
        }
        .visible-editor-host .ProseMirror::selection {
          background: transparent; /* Hide native selection, we render our own */
        }
        /* Prevent any scrolling within the page content hierarchy */
        .page-content-area {
          overflow: hidden !important;
        }
        .editor-wrapper {
          overflow: visible !important;
        }
        .editor-container {
          overflow: visible !important;
        }
        /* Prevent scroll-into-view behavior */
        .page-content-area * {
          scroll-margin: 0 !important;
          scroll-padding: 0 !important;
        }
        .visible-editor-host .ProseMirror p {
          margin: 0 0 0.5em 0;
        }
        .visible-editor-host .ProseMirror h1 {
          font-size: ${24 * zoom}px;
          font-weight: 400;
          margin: 0 0 0.5em 0;
          line-height: 1.3;
        }
        .visible-editor-host .ProseMirror h2 {
          font-size: ${18 * zoom}px;
          font-weight: 400;
          margin: 0 0 0.5em 0;
          line-height: 1.3;
        }
        .visible-editor-host .ProseMirror h3 {
          font-size: ${14 * zoom}px;
          font-weight: 700;
          margin: 0 0 0.5em 0;
          line-height: 1.3;
        }
        .visible-editor-host .ProseMirror ul,
        .visible-editor-host .ProseMirror ol {
          margin: 0 0 0.5em 0;
          padding-left: ${24 * zoom}px;
        }
        .visible-editor-host .ProseMirror li {
          margin-bottom: 0.25em;
        }
        .visible-editor-host .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5em 0;
        }
        .visible-editor-host .ProseMirror th,
        .visible-editor-host .ProseMirror td {
          border: 1px solid #dadce0;
          padding: ${4 * zoom}px ${8 * zoom}px;
          text-align: left;
          vertical-align: top;
        }
        .visible-editor-host .ProseMirror th {
          background-color: #f8f9fa;
          font-weight: 600;
        }
        .visible-editor-host .ProseMirror hr {
          border: none;
          border-top: 1px solid #dadce0;
          margin: 1em 0;
        }
        .visible-editor-host .ProseMirror a {
          color: #1a73e8;
          text-decoration: underline;
        }
        .visible-editor-host .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
        .visible-editor-host .ProseMirror-selectednode {
          outline: 2px solid #1a73e8;
        }
      `}</style>
    </div>
  );
});

// Re-export types for convenience
export type { PageConfig } from './LayoutEngine';

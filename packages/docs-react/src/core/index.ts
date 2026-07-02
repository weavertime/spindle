/**
 * Core components for the Spindle Docs layout engine
 * 
 * This module exports two architectures:
 * 
 * 1. Legacy Architecture (PresentationEditor)
 *    - Uses a single ProseMirror instance with CSS clipping
 *    - Simpler but has mid-line clipping issues
 * 
 * 2. True Layout Engine (TrueLayoutEditor)
 *    - Hidden ProseMirror + independent page rendering
 *    - Line-level pagination with no clipping issues
 */

// ============================================================================
// True Layout Engine (Recommended)
// ============================================================================

// Main component
export { TrueLayoutEditor } from './TrueLayoutEditor';
export type { TrueLayoutEditorProps, TrueLayoutEditorHandle, ActivePageInfo } from './TrueLayoutEditor';

// FlowBlocks - Abstract content representation
export * from './flow-blocks';

// ProseMirror to FlowBlocks converter
export { proseMirrorToFlowBlocks, createBlockPositionMap } from './pm-to-blocks';
export type { ConversionOptions } from './pm-to-blocks';

// DOM Measurer
export { DomMeasurer, hasLineData, getLineCount, getLineRangeHeight } from './measurer';
export type {
  MeasurerConfig,
  LineRunSegment,
  LineMeasure,
  ParagraphMeasure,
  HeadingMeasure,
  ListItemMeasure,
  TableMeasure,
  ImageMeasure,
  HorizontalRuleMeasure,
  PageBreakMeasure,
  Measure,
} from './measurer';

// True Layout Engine
export {
  computeTrueLayout,
  findBlockPage,
  findBlockFragments,
  getPageY,
  findPageAtY,
  blockPositionToPageCoords,
} from './true-layout-engine';
export type {
  PageConfig,
  PageFragment,
  PageLayout,
  DocumentLayout,
  LayoutOptions,
} from './true-layout-engine';

// DOM Painter
export { DomPainter, createPageElement } from './dom-painter';
export type { 
  PainterConfig, 
  RenderedPage, 
  PageViewProps,
  // Header/Footer types
  HeaderFooterContent,
  HeaderFooterParagraph,
  HeaderFooterInlineContent,
  HeaderFooterTextRun,
  HeaderFooterImageRun,
  DynamicFieldRun,
  DynamicFieldType,
  DynamicFieldContext,
  HeaderFooterClickHandler,
} from './dom-painter';

// Input Bridge
export { InputBridge, createInputBridge, getInputBridge } from './input-bridge';
export type { 
  VisiblePosition, 
  SelectionChangeCallback, 
  FocusChangeCallback,
  CellSelection,
  CellSelectionChangeCallback,
} from './input-bridge';

// Selection Overlay
export { SelectionOverlayManager, getSelectionOverlayStyles } from './selection-overlay';
export type { CaretPosition, SelectionRect, SelectionState } from './selection-overlay';

// Table Interactions
export { 
  TableInteractionManager, 
  createTableInteractionManager, 
  getTableInteractionManager 
} from './table-interactions';
export type { TablePosition, ResizeState, ContextMenuAction } from './table-interactions';

// Image Interactions
export { 
  ImageInteractionManager, 
  createImageInteractionManager, 
  getImageInteractionManager 
} from './image-interactions';
export type { ImagePosition } from './image-interactions';

// ============================================================================
// Legacy Architecture (Deprecated - use TrueLayoutEditor instead)
// ============================================================================

export { HiddenEditor } from './HiddenEditor';
export type { HiddenEditorHandle, HiddenEditorProps } from './HiddenEditor';

export { PresentationEditor } from './PresentationEditor';
export type { PresentationEditorProps } from './PresentationEditor';

export { PageRenderer, SelectionOverlay } from './PageRenderer';
export type { PageRendererProps, SelectionOverlayProps } from './PageRenderer';

// Legacy layout engine exports (for backward compatibility)
export {
  measureBlocks,
  computeLayout,
  findPositionInLayout,
  findPositionAtCoords,
  getPositionCoords,
  computeSelectionRects,
} from './LayoutEngine';
export type {
  PageConfig as LegacyPageConfig,
  BlockMeasurement,
  PageBlock,
  PageLayout as LegacyPageLayout,
  DocumentLayout as LegacyDocumentLayout,
  LayoutOptions as LegacyLayoutOptions,
} from './LayoutEngine';

/**
 * LayoutEngine - Measures content and calculates page breaks
 * 
 * This module:
 * 1. Measures block heights from the ProseMirror DOM
 * 2. Calculates which blocks fit on which page
 * 3. Tracks cumulative offsets for proper page clipping alignment
 * 
 * Key insight: We measure blocks and track the exact Y offset where each
 * page's content starts, ensuring subsequent pages clip at the right position.
 */

import { Node as PmNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';

/**
 * Page configuration
 */
export interface PageConfig {
  width: number;
  height: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * A measured block with its height and position
 */
export interface BlockMeasurement {
  /** The ProseMirror node */
  node: PmNode;
  /** Position in the ProseMirror document */
  pmPos: number;
  /** Measured total height in pixels */
  height: number;
  /** The DOM element for this block (if available) */
  domElement?: HTMLElement;
}

/**
 * A block assigned to a page
 */
export interface PageBlock {
  /** The measurement data for this block */
  measurement: BlockMeasurement;
  /** Y offset within the page's content area (not including margins) */
  yOffset: number;
}

/**
 * A single page in the layout
 */
export interface PageLayout {
  /** Page index (0-based) */
  pageIndex: number;
  /** Blocks on this page */
  blocks: PageBlock[];
  /** Total content height on this page */
  contentHeight: number;
  /** Cumulative Y offset from the start of the document where this page starts */
  startOffset: number;
}

/**
 * The complete document layout
 */
export interface DocumentLayout {
  /** All pages in the document */
  pages: PageLayout[];
  /** Total document height (all pages stacked) */
  totalHeight: number;
  /** Page configuration used */
  pageConfig: PageConfig;
  /** Scale factor applied */
  scale: number;
}

/**
 * Options for computing layout
 */
export interface LayoutOptions {
  pageConfig: PageConfig;
  scale: number;
  /** Default line height for estimation when DOM not available */
  defaultLineHeight?: number;
}

/**
 * Measure all top-level blocks in a ProseMirror document
 * 
 * @param doc - The ProseMirror document node
 * @param editorElement - The DOM element containing the ProseMirror editor
 * @param scale - The zoom scale factor
 * @returns Array of block measurements
 */
export function measureBlocks(
  doc: PmNode,
  editorElement: HTMLElement | null,
  scale: number = 1
): BlockMeasurement[] {
  const measurements: BlockMeasurement[] = [];

  doc.forEach((node, offset) => {
    const nodePos = offset;
    let height = 0;
    let domElement: HTMLElement | undefined;

    // Try to get actual DOM measurement
    if (editorElement) {
      // Find the DOM element for this node
      // ProseMirror renders top-level nodes as direct children of .ProseMirror
      const proseMirrorEl = editorElement.querySelector('.ProseMirror');
      if (proseMirrorEl) {
        const children = Array.from(proseMirrorEl.children) as HTMLElement[];
        const childIndex = measurements.length;
        if (childIndex < children.length) {
          domElement = children[childIndex];
          const rect = domElement.getBoundingClientRect();
          // Get the actual rendered height including margins
          const style = window.getComputedStyle(domElement);
          const marginTop = parseFloat(style.marginTop) || 0;
          const marginBottom = parseFloat(style.marginBottom) || 0;
          height = (rect.height + marginTop + marginBottom) / scale;
        }
      }
    }

    // Fallback: estimate height based on node type
    if (height === 0) {
      height = estimateBlockHeight(node);
    }

    measurements.push({
      node,
      pmPos: nodePos,
      height,
      domElement,
    });

  });

  return measurements;
}

/**
 * Estimate block height when DOM measurement is not available
 */
function estimateBlockHeight(node: PmNode): number {
  const lineHeight = 24; // Default line height in pixels
  const paragraphSpacing = 12; // Default paragraph spacing

  switch (node.type.name) {
    case 'paragraph': {
      // Estimate based on text length
      const textLength = node.textContent.length;
      const charsPerLine = 80; // Approximate
      const lines = Math.max(1, Math.ceil(textLength / charsPerLine));
      return lines * lineHeight + paragraphSpacing;
    }

    case 'heading': {
      const level = node.attrs.level || 1;
      const headingHeight = level === 1 ? 36 : level === 2 ? 28 : 22;
      return headingHeight + paragraphSpacing;
    }

    case 'bullet_list':
    case 'ordered_list': {
      let listHeight = 0;
      node.forEach((item) => {
        listHeight += estimateBlockHeight(item);
      });
      return listHeight + paragraphSpacing;
    }

    case 'list_item': {
      let itemHeight = 0;
      node.forEach((child) => {
        itemHeight += estimateBlockHeight(child);
      });
      return itemHeight;
    }

    case 'table': {
      let tableHeight = 0;
      node.forEach((row) => {
        let maxCellHeight = lineHeight;
        row.forEach((cell) => {
          let cellHeight = 0;
          cell.forEach((content) => {
            cellHeight += estimateBlockHeight(content);
          });
          maxCellHeight = Math.max(maxCellHeight, cellHeight);
        });
        tableHeight += maxCellHeight + 8; // Cell padding
      });
      return tableHeight + paragraphSpacing;
    }

    case 'image':
      return (node.attrs.height || 200) + paragraphSpacing;

    case 'horizontal_rule':
      return 24;

    default:
      return lineHeight + paragraphSpacing;
  }
}

/**
 * Compute the document layout by assigning blocks to pages
 * 
 * Uses a greedy algorithm: add blocks to the current page until
 * the page is full, then start a new page. Tracks cumulative offsets
 * for proper page clipping alignment.
 * 
 * @param doc - The ProseMirror document
 * @param editorElement - The DOM element containing the editor
 * @param options - Layout options including page config and scale
 * @returns The computed document layout
 */
export function computeLayout(
  doc: PmNode,
  editorElement: HTMLElement | null,
  options: LayoutOptions
): DocumentLayout {
  const { pageConfig, scale } = options;
  
  // Content area dimensions (excluding margins)
  const contentHeight = (pageConfig.height - pageConfig.margins.top - pageConfig.margins.bottom) * scale;
  
  // Measure all blocks
  const measurements = measureBlocks(doc, editorElement, scale);
  
  // Paginate: assign blocks to pages
  const pages: PageLayout[] = [];
  let currentPage: PageLayout = {
    pageIndex: 0,
    blocks: [],
    contentHeight: 0,
    startOffset: 0,
  };
  let currentY = 0;
  let cumulativeOffset = 0;

  for (const measurement of measurements) {
    const blockHeight = measurement.height * scale;

    // Check if this block fits on the current page
    if (currentY + blockHeight > contentHeight && currentPage.blocks.length > 0) {
      // Start a new page
      currentPage.contentHeight = currentY;
      cumulativeOffset += currentY;
      pages.push(currentPage);
      
      currentPage = {
        pageIndex: pages.length,
        blocks: [],
        contentHeight: 0,
        startOffset: cumulativeOffset,
      };
      currentY = 0;
    }

    // Add block to current page
    currentPage.blocks.push({
      measurement,
      yOffset: currentY,
    });
    currentY += blockHeight;
  }

  // Don't forget the last page
  if (currentPage.blocks.length > 0) {
    currentPage.contentHeight = currentY;
    pages.push(currentPage);
  }

  // Ensure at least one page exists
  if (pages.length === 0) {
    pages.push({
      pageIndex: 0,
      blocks: [],
      contentHeight: 0,
      startOffset: 0,
    });
  }

  // Calculate total height
  const pageHeight = pageConfig.height * scale;
  const pageGap = 24 * scale; // Gap between pages
  const totalHeight = pages.length * pageHeight + (pages.length - 1) * pageGap;

  return {
    pages,
    totalHeight,
    pageConfig,
    scale,
  };
}

/**
 * Find which page and Y offset a ProseMirror position maps to
 * 
 * @param pos - ProseMirror document position
 * @param layout - The computed document layout
 * @returns Page index and Y offset, or null if not found
 */
export function findPositionInLayout(
  pos: number,
  layout: DocumentLayout
): { pageIndex: number; yOffset: number } | null {
  for (const page of layout.pages) {
    for (const block of page.blocks) {
      const blockStart = block.measurement.pmPos;
      const blockEnd = blockStart + block.measurement.node.nodeSize;
      
      if (pos >= blockStart && pos < blockEnd) {
        // Position is within this block
        // Estimate Y offset within the block based on position ratio
        const posRatio = (pos - blockStart) / block.measurement.node.nodeSize;
        const yWithinBlock = posRatio * block.measurement.height * layout.scale;
        
        return {
          pageIndex: page.pageIndex,
          yOffset: block.yOffset + yWithinBlock,
        };
      }
    }
  }
  
  return null;
}

/**
 * Find the ProseMirror position at a given page coordinate
 * 
 * @param pageIndex - The page index
 * @param x - X coordinate within the page content area
 * @param y - Y coordinate within the page content area
 * @param layout - The computed document layout
 * @param view - The ProseMirror EditorView (for precise position mapping)
 * @returns ProseMirror position, or null if not found
 */
export function findPositionAtCoords(
  pageIndex: number,
  x: number,
  y: number,
  layout: DocumentLayout,
  view: EditorView | null
): number | null {
  const page = layout.pages[pageIndex];
  if (!page) return null;

  // Find which block contains this Y coordinate
  for (const block of page.blocks) {
    const blockTop = block.yOffset;
    const blockBottom = blockTop + block.measurement.height * layout.scale;
    
    if (y >= blockTop && y < blockBottom) {
      // Found the block
      if (view && block.measurement.domElement) {
        // Use ProseMirror's posAtCoords for precise mapping
        const rect = block.measurement.domElement.getBoundingClientRect();
        const domX = rect.left + x;
        const domY = rect.top + (y - blockTop);
        
        const posInfo = view.posAtCoords({ left: domX, top: domY });
        if (posInfo) {
          return posInfo.pos;
        }
      }
      
      // Fallback: estimate position based on Y ratio
      const yRatio = (y - blockTop) / (block.measurement.height * layout.scale);
      const posOffset = Math.floor(yRatio * block.measurement.node.nodeSize);
      return block.measurement.pmPos + Math.min(posOffset, block.measurement.node.nodeSize - 1);
    }
  }
  
  return null;
}

/**
 * Get the visual coordinates for a ProseMirror position
 * 
 * @param pos - ProseMirror document position
 * @param layout - The computed document layout
 * @param view - The ProseMirror EditorView
 * @returns Coordinates relative to the page content area, or null
 */
export function getPositionCoords(
  pos: number,
  layout: DocumentLayout,
  view: EditorView | null
): { pageIndex: number; x: number; y: number; height: number } | null {
  if (!view) return null;

  try {
    // Get coordinates from ProseMirror
    const coords = view.coordsAtPos(pos);
    
    // Get the editor element's position
    const editorRect = view.dom.getBoundingClientRect();
    
    // Calculate X relative to the editor
    const x = coords.left - editorRect.left;
    
    // Calculate Y relative to the editor (this is the absolute Y in the document)
    const absoluteY = coords.top - editorRect.top;
    
    // Calculate content height per page
    const contentHeightPerPage = (layout.pageConfig.height - layout.pageConfig.margins.top - layout.pageConfig.margins.bottom) * layout.scale;
    
    // Determine which page this Y coordinate falls on
    const pageIndex = Math.max(0, Math.floor(absoluteY / contentHeightPerPage));
    
    // Calculate Y relative to the page's content area
    const y = absoluteY - (pageIndex * contentHeightPerPage);
    
    // Get line height
    const height = coords.bottom - coords.top;

    return {
      pageIndex,
      x,
      y,
      height,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Compute selection rectangles for a range
 * 
 * @param from - Start position
 * @param to - End position
 * @param layout - The computed document layout
 * @param view - The ProseMirror EditorView
 * @returns Array of selection rectangles with page assignments
 */
export function computeSelectionRects(
  from: number,
  to: number,
  layout: DocumentLayout,
  view: EditorView | null
): Array<{ pageIndex: number; x: number; y: number; width: number; height: number }> {
  if (!view || from === to) return [];

  const rects: Array<{ pageIndex: number; x: number; y: number; width: number; height: number }> = [];
  
  try {
    // Get selection coordinates from ProseMirror
    const startCoords = view.coordsAtPos(from);
    const endCoords = view.coordsAtPos(to);
    
    // Find pages for start and end
    const startPage = findPositionInLayout(from, layout);
    const endPage = findPositionInLayout(to, layout);
    
    if (!startPage || !endPage) return [];

    // For simplicity, create a single rect (multi-line selection is complex)
    // A full implementation would iterate through all lines in the selection
    
    const editorRect = view.dom.getBoundingClientRect();
    const contentWidth = (layout.pageConfig.width - layout.pageConfig.margins.left - layout.pageConfig.margins.right) * layout.scale;

    if (startPage.pageIndex === endPage.pageIndex) {
      // Selection is on a single page
      rects.push({
        pageIndex: startPage.pageIndex,
        x: startCoords.left - editorRect.left,
        y: startPage.yOffset,
        width: Math.min(endCoords.right - startCoords.left, contentWidth),
        height: endPage.yOffset - startPage.yOffset + (endCoords.bottom - endCoords.top),
      });
    } else {
      // Selection spans multiple pages - create rect for each page
      // This is a simplified implementation
      for (let pageIdx = startPage.pageIndex; pageIdx <= endPage.pageIndex; pageIdx++) {
        const page = layout.pages[pageIdx];
        if (!page) continue;

        const isFirstPage = pageIdx === startPage.pageIndex;
        const isLastPage = pageIdx === endPage.pageIndex;

        rects.push({
          pageIndex: pageIdx,
          x: isFirstPage ? startCoords.left - editorRect.left : 0,
          y: isFirstPage ? startPage.yOffset : 0,
          width: contentWidth,
          height: isLastPage ? endPage.yOffset + (endCoords.bottom - endCoords.top) : page.contentHeight,
        });
      }
    }
  } catch (e) {
    // Ignore coordinate errors
  }

  return rects;
}

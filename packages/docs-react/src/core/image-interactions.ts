/**
 * Image Interactions - Handles image dragging and repositioning
 * 
 * This module provides interactive features for images in the True Layout Engine:
 * 1. Drag handle for moving images
 * 2. Drag and drop repositioning within the document
 */

import { EditorView } from 'prosemirror-view';

// ============================================================================
// Types
// ============================================================================

export interface ImagePosition {
  imageEl: HTMLElement;
  pmStart: number;
  pmEnd: number;
}

// ============================================================================
// Image Interaction Manager
// ============================================================================

export class ImageInteractionManager {
  private container: HTMLElement | null = null;
  private editorView: EditorView | null = null;
  
  // Drag handle
  private dragHandle: HTMLElement | null = null;
  private currentImageEl: HTMLElement | null = null;
  private isHoveringHandle: boolean = false;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Drag state
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragImageEl: HTMLElement | null = null;
  private dragGhost: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  private dropTargetPos: number | null = null;
  private dragState: { imagePmStart: number; imagePmEnd: number } | null = null;
  
  // Bound event handlers
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  
  // Callbacks
  private onImageUpdate: (() => void) | null = null;
  
  constructor() {
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
  }
  
  /**
   * Initialize the image interaction manager
   */
  initialize(
    container: HTMLElement,
    editorView: EditorView,
    options?: {
      onImageUpdate?: () => void;
    }
  ): void {
    this.container = container;
    this.editorView = editorView;
    this.onImageUpdate = options?.onImageUpdate ?? null;
    
    // Add event listeners
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }
  
  /**
   * Update after layout changes
   */
  updateLayout(): void {
    this.hideDragHandle();
  }
  
  /**
   * Update the scale factor (call when zoom changes)
   * Currently unused but kept for future zoom-aware positioning
   */
  setScale(_scale: number): void {
    // Reserved for future use when image interactions need zoom awareness
  }
  
  /**
   * Show drag handle for an image on hover
   */
  showHandlesForImage(imageEl: HTMLElement): void {
    this.showDragHandle(imageEl);
  }
  
  /**
   * Hide drag handle
   */
  hideDragHandle(): void {
    if (this.dragHandle) {
      this.dragHandle.style.display = 'none';
    }
    this.currentImageEl = null;
  }
  
  /**
   * Check if currently hovering over the handle
   */
  isHoveringOverHandles(): boolean {
    return this.isHoveringHandle;
  }
  
  /**
   * Schedule hiding of handles with a delay
   */
  scheduleHideHandles(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    this.hideTimeout = setTimeout(() => {
      if (!this.isHoveringHandle) {
        this.hideDragHandle();
      }
      this.hideTimeout = null;
    }, 100);
  }
  
  /**
   * Cancel scheduled hide
   */
  cancelScheduledHide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
  
  /**
   * Get the current image element
   */
  getCurrentImageEl(): HTMLElement | null {
    return this.currentImageEl;
  }
  
  /**
   * Destroy the manager and clean up
   */
  destroy(): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    
    this.hideDragHandle();
    this.dragHandle?.remove();
    
    this.container = null;
    this.editorView = null;
  }
  
  // ============================================================================
  // Drag Handle
  // ============================================================================
  
  private showDragHandle(imageEl: HTMLElement): void {
    if (!this.container) return;
    
    if (!this.dragHandle) {
      this.dragHandle = document.createElement('div');
      this.dragHandle.className = 'image-drag-handle';
      this.dragHandle.innerHTML = `
        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
          <circle cx="3" cy="4" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/>
          <circle cx="3" cy="16" r="1.5"/>
          <circle cx="9" cy="4" r="1.5"/>
          <circle cx="9" cy="10" r="1.5"/>
          <circle cx="9" cy="16" r="1.5"/>
        </svg>
      `;
      this.dragHandle.style.cssText = `
        position: absolute;
        width: 20px;
        height: 32px;
        background: #fff;
        border: 1px solid #dadce0;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        z-index: 101;
        color: #5f6368;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      `;
      
      this.dragHandle.addEventListener('mouseenter', () => {
        this.isHoveringHandle = true;
        this.cancelScheduledHide();
        this.dragHandle!.style.background = '#f1f3f4';
      });
      
      this.dragHandle.addEventListener('mouseleave', () => {
        if (!this.isDragging) {
          this.isHoveringHandle = false;
          this.dragHandle!.style.background = '#fff';
          if (!this.currentImageEl?.matches(':hover')) {
            this.hideDragHandle();
          }
        }
      });
      
      this.dragHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.currentImageEl) {
          this.startImageDrag(this.currentImageEl, e.clientY);
        }
      });
      
      this.container.appendChild(this.dragHandle);
    }
    
    const imageRect = imageEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    // Position on the left side, vertically centered
    this.dragHandle.style.display = 'flex';
    this.dragHandle.style.top = `${imageRect.top - containerRect.top + (imageRect.height / 2) - 16}px`;
    this.dragHandle.style.left = `${imageRect.left - containerRect.left - 28}px`;
    
    this.currentImageEl = imageEl;
  }
  
  // ============================================================================
  // Image Drag (Move Up/Down)
  // ============================================================================
  
  private startImageDrag(imageEl: HTMLElement, startY: number): void {
    const pmStart = parseInt(imageEl.dataset.pmStart || '0', 10);
    const pmEnd = parseInt(imageEl.dataset.pmEnd || '0', 10);
    
    this.isDragging = true;
    this.dragStartY = startY;
    this.dragImageEl = imageEl;
    this.dropTargetPos = null;
    this.dragState = { imagePmStart: pmStart, imagePmEnd: pmEnd };
    
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    if (this.dragHandle) {
      this.dragHandle.style.cursor = 'grabbing';
    }
    
    // Create ghost element
    const imageRect = imageEl.getBoundingClientRect();
    this.dragGhost = document.createElement('div');
    this.dragGhost.style.cssText = `
      position: fixed;
      top: ${imageRect.top}px;
      left: ${imageRect.left}px;
      width: ${imageRect.width}px;
      height: ${imageRect.height}px;
      background: rgba(26, 115, 232, 0.08);
      border: 2px dashed #1a73e8;
      border-radius: 4px;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(this.dragGhost);
    
    // Create drop indicator
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      height: 3px;
      background: #1a73e8;
      pointer-events: none;
      z-index: 10001;
      display: none;
      box-shadow: 0 0 4px rgba(26, 115, 232, 0.5);
    `;
    document.body.appendChild(this.dropIndicator);
    
    // Dim the original image
    imageEl.style.opacity = '0.4';
  }
  
  private handleImageDrag(clientY: number): void {
    if (!this.isDragging || !this.dragImageEl || !this.container || !this.dragState) return;
    
    // Move ghost
    if (this.dragGhost) {
      const deltaY = clientY - this.dragStartY;
      const imageRect = this.dragImageEl.getBoundingClientRect();
      this.dragGhost.style.top = `${imageRect.top + deltaY}px`;
    }
    
    const { imagePmStart, imagePmEnd } = this.dragState;
    
    // Find all top-level fragments
    const fragments = this.container.querySelectorAll('.fragment');
    
    interface FragmentInfo {
      element: HTMLElement;
      pmStart: number;
      pmEnd: number;
      top: number;
      bottom: number;
      isListItem: boolean;
    }
    
    const allFragments: FragmentInfo[] = [];
    
    for (const fragment of fragments) {
      const fragmentEl = fragment as HTMLElement;
      
      const blockWithPos = fragmentEl.querySelector('[data-pm-start]') as HTMLElement | null;
      if (!blockWithPos) continue;
      
      const pmStart = parseInt(blockWithPos.dataset.pmStart || '0', 10);
      const pmEnd = parseInt(blockWithPos.dataset.pmEnd || '0', 10);
      
      // Skip the image itself
      if (pmStart >= imagePmStart && pmStart <= imagePmEnd) continue;
      
      // Skip if inside a table cell
      if (blockWithPos.closest('.table-cell')) continue;
      
      const rect = fragmentEl.getBoundingClientRect();
      const isListItem = fragmentEl.querySelector('ul, ol') !== null;
      
      allFragments.push({
        element: fragmentEl,
        pmStart,
        pmEnd,
        top: rect.top,
        bottom: rect.bottom,
        isListItem,
      });
    }
    
    // Sort by vertical position
    allFragments.sort((a, b) => a.top - b.top);
    
    // Group consecutive list items
    interface DropTarget {
      element: HTMLElement;
      pmStart: number;
      pmEnd: number;
      top: number;
      bottom: number;
    }
    
    const validTargets: DropTarget[] = [];
    let i = 0;
    
    while (i < allFragments.length) {
      const frag = allFragments[i];
      
      if (frag.isListItem) {
        const groupStart = frag.pmStart;
        let groupEnd = frag.pmEnd;
        const groupTop = frag.top;
        let groupBottom = frag.bottom;
        const firstElement = frag.element;
        
        let j = i + 1;
        while (j < allFragments.length && allFragments[j].isListItem) {
          groupEnd = allFragments[j].pmEnd;
          groupBottom = allFragments[j].bottom;
          j++;
        }
        
        validTargets.push({
          element: firstElement,
          pmStart: groupStart,
          pmEnd: groupEnd,
          top: groupTop,
          bottom: groupBottom,
        });
        
        i = j;
      } else {
        validTargets.push({
          element: frag.element,
          pmStart: frag.pmStart,
          pmEnd: frag.pmEnd,
          top: frag.top,
          bottom: frag.bottom,
        });
        i++;
      }
    }
    
    // Find best drop position
    let bestTarget: DropTarget | null = null;
    let insertBefore = true;
    
    if (validTargets.length > 0) {
      if (clientY < validTargets[0].top) {
        bestTarget = validTargets[0];
        insertBefore = true;
      } else {
        for (let idx = 0; idx < validTargets.length; idx++) {
          const target = validTargets[idx];
          
          if (clientY >= target.top && clientY <= target.bottom) {
            const midPoint = (target.top + target.bottom) / 2;
            if (clientY < midPoint) {
              bestTarget = target;
              insertBefore = true;
            } else {
              bestTarget = target;
              insertBefore = false;
            }
            break;
          } else if (clientY > target.bottom) {
            bestTarget = target;
            insertBefore = false;
          } else if (clientY < target.top && bestTarget) {
            break;
          }
        }
      }
    }
    
    // Position drop indicator
    if (bestTarget && this.dropIndicator) {
      const indicatorY = insertBefore ? bestTarget.top : bestTarget.bottom;
      
      const pageEl = bestTarget.element.closest('.page-content') || bestTarget.element.closest('.editor-page');
      let left = bestTarget.element.getBoundingClientRect().left;
      let width = bestTarget.element.getBoundingClientRect().width;
      
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        left = pageRect.left + 40;
        width = pageRect.width - 80;
      }
      
      this.dropIndicator.style.display = 'block';
      this.dropIndicator.style.top = `${indicatorY - 1}px`;
      this.dropIndicator.style.left = `${left}px`;
      this.dropIndicator.style.width = `${width}px`;
      
      this.dropTargetPos = insertBefore ? bestTarget.pmStart : bestTarget.pmEnd;
    } else if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
      this.dropTargetPos = null;
    }
  }
  
  private endImageDrag(): void {
    if (!this.isDragging || !this.dragImageEl || !this.editorView || !this.dragState) {
      this.cleanupDrag();
      return;
    }
    
    const { state, dispatch } = this.editorView;
    const { imagePmStart, imagePmEnd } = this.dragState;
    const targetPos = this.dropTargetPos;
    
    if (targetPos !== null && targetPos !== imagePmStart && targetPos !== imagePmEnd) {
      try {
        // Get the image node
        const $start = state.doc.resolve(imagePmStart);
        let imageNode = null;
        let imagePos = imagePmStart;
        
        // Find the image node
        for (let d = $start.depth; d >= 0; d--) {
          const node = $start.node(d);
          if (node.type.name === 'image') {
            imageNode = node;
            imagePos = $start.before(d);
            break;
          }
        }
        
        if (!imageNode) {
          const node = state.doc.nodeAt(imagePmStart);
          if (node?.type.name === 'image') {
            imageNode = node;
            imagePos = imagePmStart;
          }
        }
        
        if (imageNode) {
          let tr = state.tr;
          
          // Delete the image from its current position
          tr = tr.delete(imagePos, imagePos + imageNode.nodeSize);
          
          // Adjust target position
          let adjustedTargetPos = targetPos;
          if (targetPos > imagePos) {
            adjustedTargetPos = targetPos - imageNode.nodeSize;
          }
          
          // Insert at new position
          tr = tr.insert(adjustedTargetPos, imageNode);
          
          dispatch(tr);
          
          if (this.onImageUpdate) {
            this.onImageUpdate();
          }
        }
      } catch (err) {
        console.error('Error moving image:', err);
      }
    }
    
    this.cleanupDrag();
  }
  
  private cleanupDrag(): void {
    if (this.dropIndicator) {
      this.dropIndicator.remove();
      this.dropIndicator = null;
    }
    
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    
    if (this.dragImageEl) {
      this.dragImageEl.style.opacity = '1';
      this.dragImageEl = null;
    }
    
    this.isDragging = false;
    this.dragStartY = 0;
    this.dropTargetPos = null;
    this.dragState = null;
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (this.dragHandle) {
      this.dragHandle.style.cursor = 'grab';
    }
  }
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      this.handleImageDrag(e.clientY);
    }
  }
  
  private handleMouseUp(_e: MouseEvent): void {
    if (this.isDragging) {
      this.endImageDrag();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let imageInteractionInstance: ImageInteractionManager | null = null;

/**
 * Get the singleton image interaction manager
 */
export function getImageInteractionManager(): ImageInteractionManager {
  if (!imageInteractionInstance) {
    imageInteractionInstance = new ImageInteractionManager();
  }
  return imageInteractionInstance;
}

/**
 * Create a new image interaction manager instance
 */
export function createImageInteractionManager(): ImageInteractionManager {
  return new ImageInteractionManager();
}


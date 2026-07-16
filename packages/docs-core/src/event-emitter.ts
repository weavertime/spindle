// Event emitter for document events

import type { DocumentEventData, DocumentEventHandler, DocumentEventType } from './types';

export class DocumentEventEmitter {
  private handlers: Map<DocumentEventType, Set<DocumentEventHandler>> = new Map();
  private batchQueue: DocumentEventData[] = [];
  private batchDepth = 0;

  on(event: DocumentEventType, handler: DocumentEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  off(event: DocumentEventType, handler: DocumentEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: DocumentEventType, payload: unknown): void {
    const data: DocumentEventData = { type: event, payload };

    if (this.batchDepth > 0) {
      this.batchQueue.push(data);
      return;
    }

    this.dispatch(data);
  }

  private dispatch(data: DocumentEventData): void {
    const handlers = this.handlers.get(data.type);
    if (handlers) {
      // Snapshot: a handler that subscribes/unsubscribes during emit must not
      // double-fire or skip, and must not loop while iterating a live Set.
      for (const handler of [...handlers]) {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in document event handler:', error);
        }
      }
    }
  }

  batch(operations: () => void): void {
    // Depth-count so a nested batch() doesn't clear the outer queue (losing
    // events) or flush early — only the outermost batch dispatches, once.
    this.batchDepth++;
    try {
      operations();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        const events = this.batchQueue;
        this.batchQueue = [];
        for (const event of events) {
          this.dispatch(event);
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
    this.batchQueue = [];
  }
}


// Small store for editor-chrome UI state that several components share — e.g.
// whether the comments sidebar is open (toggled from the header, and opened by
// clicking a comment badge on an element).

export class UIStore {
  private commentsOpen = false;
  private listeners = new Set<() => void>();

  getCommentsOpen = (): boolean => this.commentsOpen;

  setCommentsOpen(open: boolean): void {
    if (this.commentsOpen === open) return;
    this.commentsOpen = open;
    for (const l of this.listeners) l();
  }

  toggleComments(): void {
    this.setCommentsOpen(!this.commentsOpen);
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
}

// Small store for editor-chrome UI state that several components share — e.g.
// whether the comments sidebar is open (toggled from the header, and opened by
// clicking a comment badge on an element).

export class UIStore {
  private commentsOpen = false;
  // The slide thumbnail rail. Shown by default on desktop; SlidesEditor flips it
  // to hidden on mobile (where it opens as a slide-over drawer instead).
  private filmstripOpen = true;
  private listeners = new Set<() => void>();

  getCommentsOpen = (): boolean => this.commentsOpen;

  setCommentsOpen(open: boolean): void {
    if (this.commentsOpen === open) return;
    this.commentsOpen = open;
    this.emit();
  }

  toggleComments(): void {
    this.setCommentsOpen(!this.commentsOpen);
  }

  getFilmstripOpen = (): boolean => this.filmstripOpen;

  setFilmstripOpen(open: boolean): void {
    if (this.filmstripOpen === open) return;
    this.filmstripOpen = open;
    this.emit();
  }

  toggleFilmstrip(): void {
    this.setFilmstripOpen(!this.filmstripOpen);
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

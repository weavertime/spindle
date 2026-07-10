// Real rendered row geometry for each table, measured from the DOM by TableView
// and consumed by the gutter/resize overlays. Row heights are content-driven (a
// row grows to fit its text), so the fractions in the element record can't tell
// the overlays where the row boundaries actually are — they read the measured
// positions from here instead. Values are top offsets as a fraction (0..1) of
// the table's height, with rows+1 entries (each row start, then the bottom).

export type RowTops = number[];

export class TableMetricsStore {
  private map = new Map<string, RowTops>();
  private listeners = new Set<() => void>();

  get = (id: string): RowTops | undefined => this.map.get(id);

  set(id: string, rowTops: RowTops): void {
    const prev = this.map.get(id);
    if (prev && prev.length === rowTops.length && prev.every((v, i) => Math.abs(v - rowTops[i]) < 0.001)) return;
    this.map.set(id, rowTops);
    this.emit();
  }

  clear(id: string): void {
    if (this.map.delete(id)) this.emit();
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

// Registry of element-id → wrapper DOM node. Gestures write transforms
// directly onto these nodes during a drag (no React state per move); React
// reconciles once on commit. ElementView registers itself via a ref callback.

export class NodeRegistry {
  private nodes = new Map<string, HTMLElement>();

  register(id: string, node: HTMLElement): void {
    this.nodes.set(id, node);
  }

  unregister(id: string): void {
    this.nodes.delete(id);
  }

  get(id: string): HTMLElement | undefined {
    return this.nodes.get(id);
  }
}

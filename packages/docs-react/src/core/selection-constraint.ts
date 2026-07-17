// Keep a text selection from crossing an isolating boundary (a table or table
// cell). Without prosemirror-tables' CellSelection installed, a raw TextSelection
// with one endpoint inside a cell and the other outside — or in a different cell
// — deletes/merges rows and cells on the next edit. Clamping the head into the
// anchor's isolating node (or out of the head's) keeps both endpoints in the same
// cell/block context so an edit can only ever affect content, never structure.

import type { Node as PmNode } from 'prosemirror-model';

/**
 * Return a head position (`to`) constrained so the selection [anchor, to] does
 * not cross an isolating node boundary relative to `anchor`.
 */
export function constrainSelectionToIsolatingBlock(doc: PmNode, anchor: number, to: number): number {
  const $anchor = doc.resolve(anchor);
  const $to = doc.resolve(to);
  const shared = $anchor.sharedDepth(to);
  // Walk from the shared context outward (shallow → deep) so we clamp at the
  // OUTERMOST isolating boundary the selection crosses, not an inner one.
  // The anchor sits inside an isolating node the head is leaving → clamp head in.
  for (let d = shared + 1; d <= $anchor.depth; d++) {
    if ($anchor.node(d).type.spec.isolating) {
      return Math.max($anchor.start(d), Math.min(to, $anchor.end(d)));
    }
  }
  // The head is entering an isolating node the anchor isn't in → clamp head out.
  for (let d = shared + 1; d <= $to.depth; d++) {
    if ($to.node(d).type.spec.isolating) {
      return to > anchor ? $to.before(d) : $to.after(d);
    }
  }
  return to;
}

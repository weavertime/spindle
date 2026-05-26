import * as Y from 'yjs';
import {
  hydrateYDocFromData,
  serializeYDocToData,
  getWorkbookYTypes,
  getSheetYTypes,
  mergedRegionKey,
} from './y-schema';
import type { MergedRegion, WorkbookData } from '../types';

function blankWorkbook(): WorkbookData {
  return {
    id: 'wb',
    name: 'Test',
    activeSheetId: 's1',
    defaultRowHeight: 20,
    defaultColWidth: 100,
    stylePool: {},
    formatPool: {},
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        cells: [],
        rowOrder: [],
        colOrder: [],
        config: {},
        rowCount: 100,
        colCount: 26,
      },
    ],
  };
}

describe('y-schema mergedRegions round-trip', () => {
  it('hydrates merged regions into the Y.Doc and reads them back', () => {
    const data = blankWorkbook();
    data.sheets[0].config.mergedRegions = [
      { startRowId: 'r1', startColId: 'c1', endRowId: 'r3', endColId: 'c2' },
    ];

    const ydoc = new Y.Doc();
    hydrateYDocFromData(ydoc, data);

    const out = serializeYDocToData(ydoc, undefined, 's1');
    expect(out.sheets[0].config.mergedRegions).toEqual([
      { startRowId: 'r1', startColId: 'c1', endRowId: 'r3', endColId: 'c2' },
    ]);
  });

  it('omits mergedRegions when the source has none', () => {
    const ydoc = new Y.Doc();
    hydrateYDocFromData(ydoc, blankWorkbook());
    const out = serializeYDocToData(ydoc, undefined, 's1');
    expect(out.sheets[0].config.mergedRegions).toBeUndefined();
  });

  it('converges concurrent non-overlapping merges from two peers', () => {
    // Two peers start from the same initial state, each adds a different
    // merge concurrently, then they sync — both regions should survive
    // (no whole-array LWW dropping one).
    const initial = blankWorkbook();
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    hydrateYDocFromData(docA, initial);
    hydrateYDocFromData(docB, initial);
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));

    const regionA: MergedRegion = {
      startRowId: 'r1', startColId: 'c1', endRowId: 'r2', endColId: 'c2',
    };
    const regionB: MergedRegion = {
      startRowId: 'r5', startColId: 'c5', endRowId: 'r6', endColId: 'c6',
    };
    getSheetYTypes(getWorkbookYTypes(docA).sheets.get('s1')!).mergedRegions.set(
      mergedRegionKey(regionA),
      regionA,
    );
    getSheetYTypes(getWorkbookYTypes(docB).sheets.get('s1')!).mergedRegions.set(
      mergedRegionKey(regionB),
      regionB,
    );

    // Cross-sync the concurrent updates.
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    const outA = serializeYDocToData(docA, undefined, 's1').sheets[0].config.mergedRegions;
    const outB = serializeYDocToData(docB, undefined, 's1').sheets[0].config.mergedRegions;
    expect(outA).toEqual([regionA, regionB]); // sorted by composite key
    expect(outB).toEqual(outA);
  });

  it('two peers see the same iteration order regardless of write order', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    hydrateYDocFromData(docA, blankWorkbook());
    hydrateYDocFromData(docB, blankWorkbook());
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));

    // Peer A writes region X then Y; peer B writes Y then X.
    const x: MergedRegion = { startRowId: 'r1', startColId: 'c1', endRowId: 'r2', endColId: 'c2' };
    const y: MergedRegion = { startRowId: 'r9', startColId: 'c9', endRowId: 'r10', endColId: 'c10' };
    const tA = getSheetYTypes(getWorkbookYTypes(docA).sheets.get('s1')!).mergedRegions;
    const tB = getSheetYTypes(getWorkbookYTypes(docB).sheets.get('s1')!).mergedRegions;
    tA.set(mergedRegionKey(x), x);
    tA.set(mergedRegionKey(y), y);
    tB.set(mergedRegionKey(y), y);
    tB.set(mergedRegionKey(x), x);

    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    const outA = serializeYDocToData(docA, undefined, 's1').sheets[0].config.mergedRegions;
    const outB = serializeYDocToData(docB, undefined, 's1').sheets[0].config.mergedRegions;
    expect(outA).toEqual(outB);
  });
});

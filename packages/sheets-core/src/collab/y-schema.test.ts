import * as Y from 'yjs';
import { hydrateYDocFromData, serializeYDocToData } from './y-schema';
import type { WorkbookData } from '../types';

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
});

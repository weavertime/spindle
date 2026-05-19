import { useState, useEffect } from 'react';
import { WorkbookProvider, WorkbookCanvas } from '@pagent-libs/sheets-react';
import { WorkbookImpl } from '@pagent-libs/sheets-core';
import { InMemoryProvider, type CollabIdentity } from '@pagent-libs/shared';
import './App.css';

// Sample workbook data lifted out so both single-editor and collab demo
// can hydrate from the same starting state.
const sampleWorkbookData = (() => {
  const data = {
      id: 'demo-workbook',
      name: 'Demo Spreadsheet',
      activeSheetId: 'sheet_1',
      defaultRowHeight: 20,
      defaultColWidth: 100,
      stylePool: {},
      formatPool: {},
      sheets: [
        {
          id: 'sheet_1',
          name: 'Sheet1',
          cells: [
            { key: '0:0', cell: { value: 'Product' } },
            { key: '0:1', cell: { value: 'Price' } },
            { key: '0:2', cell: { value: 'Quantity' } },
            { key: '0:3', cell: { value: 'Total' } },
            { key: '1:0', cell: { value: 'Widget' } },
            { key: '1:1', cell: { value: 10 } },
            { key: '1:2', cell: { value: 5 } },
            { key: '1:3', cell: { value: 50 } },
            { key: '2:0', cell: { value: 'Gadget' } },
            { key: '2:1', cell: { value: 20 } },
            { key: '2:2', cell: { value: 3 } },
            { key: '2:3', cell: { value: 60 } },
            { key: '3:0', cell: { value: 'Thing' } },
            { key: '3:1', cell: { value: 15 } },
            { key: '3:2', cell: { value: 2 } },
            { key: '3:3', cell: { value: 30 } },
          ],
          config: {
            defaultRowHeight: 20,
            defaultColWidth: 100,
            showGridLines: true,
          },
          rowCount: 1000,
          colCount: 100,
        },
      ],
      selection: {
        ranges: [],
        activeCell: { row: 0, col: 0 },
      },
    };
  return data;
})();

function makeWorkbookFromSample(id = 'demo-workbook', name = 'Demo Spreadsheet'): WorkbookImpl {
  const wb = new WorkbookImpl(id, name);
  wb.setData({ ...sampleWorkbookData, id, name });
  // Demonstrate some formatting after load.
  wb.setCell(undefined, 1, 3, {
    ...wb.getCell(undefined, 1, 3),
    formatId: wb.getFormatPool().getOrCreate({ type: 'currency', currencyCode: 'USD' }),
  });
  wb.setCell(undefined, 2, 3, {
    ...wb.getCell(undefined, 2, 3),
    formatId: wb.getFormatPool().getOrCreate({ type: 'currency', currencyCode: 'USD' }),
  });
  return wb;
}

// Phase 2b.6 smoke-test panel. Two WorkbookImpls sharing an InMemoryProvider
// room; edits in one pane should converge into the other.
function CollabDemo({ width, height }: { width: number; height: number }) {
  const [workbooks, setWorkbooks] = useState<[WorkbookImpl, WorkbookImpl] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let wbA: WorkbookImpl | null = null;
    let wbB: WorkbookImpl | null = null;

    (async () => {
      try {
        wbA = makeWorkbookFromSample('collab-workbook', 'Shared Workbook');
        wbB = makeWorkbookFromSample('collab-workbook', 'Shared Workbook');

        const providerA = new InMemoryProvider();
        const providerB = new InMemoryProvider();

        const identityA: CollabIdentity = {
          userId: 'user_a',
          displayName: 'Alice',
          color: '#ff6b6b',
        };
        const identityB: CollabIdentity = {
          userId: 'user_b',
          displayName: 'Bob',
          color: '#4ecdc4',
        };

        await Promise.all([
          wbA.attachCollab(providerA, identityA),
          wbB.attachCollab(providerB, identityB),
        ]);
        if (cancelled) {
          wbA.detachCollab();
          wbB.detachCollab();
          return;
        }
        setWorkbooks([wbA, wbB]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      try { wbA?.detachCollab(); } catch { /* ignore */ }
      try { wbB?.detachCollab(); } catch { /* ignore */ }
    };
  }, []);

  if (error) return <div style={{ padding: 16, color: 'crimson' }}>Error: {error}</div>;
  if (!workbooks) return <div style={{ padding: 16 }}>Connecting collab peers…</div>;

  const paneWidth = Math.floor(width / 2) - 1;
  const paneHeight = height - 28; // peer label strip
  const paneStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e0e0e0',
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={paneStyle}>
        <div style={{ padding: '4px 12px', background: '#ff6b6b', color: 'white', fontWeight: 500 }}>Alice</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WorkbookProvider workbook={workbooks[0]}>
            <WorkbookCanvas width={paneWidth} height={paneHeight} />
          </WorkbookProvider>
        </div>
      </div>
      <div style={{ ...paneStyle, borderRight: 'none' }}>
        <div style={{ padding: '4px 12px', background: '#4ecdc4', color: 'white', fontWeight: 500 }}>Bob</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WorkbookProvider workbook={workbooks[1]}>
            <WorkbookCanvas width={paneWidth} height={paneHeight} />
          </WorkbookProvider>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [collabMode, setCollabMode] = useState(false);
  const [workbook] = useState(() => makeWorkbookFromSample());

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 100,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 100,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSave = () => {
    const data = workbook.getData();
    console.log('workbook data', data);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pagent Sheets Demo</h1>
        <p>Standalone demo of pagent-sheets library - No backend required</p>
        <button onClick={handleSave} style={{ marginTop: '10px', padding: '8px 16px' }}>
          Save Workbook Data
        </button>
        <button
          onClick={() => setCollabMode((v) => !v)}
          style={{ marginTop: '10px', marginLeft: '8px', padding: '8px 16px' }}
        >
          {collabMode ? 'Single editor' : 'Collab demo'}
        </button>
      </header>
      <main className="app-main">
        {collabMode ? (
          <CollabDemo width={dimensions.width} height={dimensions.height} />
        ) : (
          <WorkbookProvider workbook={workbook}>
            <WorkbookCanvas width={dimensions.width} height={dimensions.height} />
          </WorkbookProvider>
        )}
      </main>
    </div>
  );
}

export default App;


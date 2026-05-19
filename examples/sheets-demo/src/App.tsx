import { useState, useEffect, useCallback } from 'react';
import { WorkbookProvider, WorkbookCanvas } from '@pagent-libs/sheets-react';
import { WorkbookImpl } from '@pagent-libs/sheets-core';
import './App.css';

function App() {
  const [workbook] = useState(() => {
    const wb = new WorkbookImpl('demo-workbook', 'Demo Spreadsheet');

    // Define sample data as a complete workbook data object
    const workbookData = {
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

    // Set the complete workbook data
    wb.setData(workbookData);

    // Apply some formats to demonstrate formatting works
    wb.setCell(undefined, 1, 3, { ...wb.getCell(undefined, 1, 3), formatId: wb.getFormatPool().getOrCreate({ type: 'currency', currencyCode: 'USD' }) });
    wb.setCell(undefined, 2, 3, { ...wb.getCell(undefined, 2, 3), formatId: wb.getFormatPool().getOrCreate({ type: 'currency', currencyCode: 'USD' }) });

    return wb;
  });

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
      </header>
      <main className="app-main">
        <WorkbookProvider workbook={workbook}>
          <WorkbookCanvas width={dimensions.width} height={dimensions.height} />
        </WorkbookProvider>
      </main>
    </div>
  );
}

export default App;


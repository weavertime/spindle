# Extending Pagent-Libs

This guide explains how to extend Spindle with new features, formula functions, export formats, collaboration providers, and custom rendering.

## Adding New Features

### Feature Architecture

Features are implemented as managers that operate on workbook/sheet state:

```typescript
// packages/sheets-core/src/features/my-feature.ts
export class MyFeatureManager {
  static applyFeature(sheet: Sheet, config: MyFeatureConfig): void {
    // Implement feature logic
  }

  static getFeatureState(sheet: Sheet): MyFeatureState {
    // Return current feature state
  }

  static clearFeature(sheet: Sheet): void {
    // Clean up feature state
  }
}
```

### Integration with Workbook

Add feature methods to the workbook interface:

```typescript
// In workbook.ts
applyMyFeature(config: MyFeatureConfig, sheetId?: string): void {
  const sheet = this.getSheet(sheetId);
  MyFeatureManager.applyFeature(sheet, config);
  this.recordHistory();
  this.events.emit('sheetChange', { sheetId });
}

getMyFeatureState(sheetId?: string): MyFeatureState {
  const sheet = this.getSheet(sheetId);
  return MyFeatureManager.getFeatureState(sheet);
}
```

### Adding to SheetConfig

Extend the sheet configuration to persist feature state:

```typescript
interface SheetConfig {
  // ... existing properties
  myFeature?: MyFeatureConfig;
}
```

## Adding New Formula Functions

### Function Registration

Add functions to the formula parser:

```typescript
// packages/sheets-core/src/formula-parser/parser.ts
private registerBuiltInFunctions(): void {
  // ... existing functions

  // Add custom function
  this.functions.set('MYFUNCTION', (args, ctx) => {
    // Validate arguments
    if (args.length < 2) return '#ERROR!';

    // Process arguments (arrays are flattened ranges)
    const values = this.flattenArgs(args, ctx);

    // Implement function logic
    return values.reduce((result, value) => {
      // Custom logic here
      return result;
    }, initialValue);
  });
}
```

### Function Categories

- **Mathematical**: SIN, COS, SQRT, POWER
- **Statistical**: AVERAGE, MEDIAN, MODE, STDEV
- **Text**: CONCATENATE, LEFT, RIGHT, MID, LEN
- **Date/Time**: TODAY, NOW, DATE, TIME
- **Logical**: IF, AND, OR, NOT
- **Lookup**: VLOOKUP, HLOOKUP, INDEX, MATCH

### Error Handling

Functions should return error strings for invalid inputs:

```typescript
this.functions.set('SAFE_DIVIDE', (args, ctx) => {
  if (args.length !== 2) return '#ERROR!';
  const [numerator, denominator] = args;

  if (denominator === 0) return '#DIV/0!';
  if (typeof numerator !== 'number' || typeof denominator !== 'number') {
    return '#VALUE!';
  }

  return numerator / denominator;
});
```

## Adding New Export Formats

### Export Manager Pattern

Implement export functionality:

```typescript
// packages/sheets-core/src/export/my-format.ts
export function exportToMyFormat(workbook: WorkbookImpl, sheetId?: string): string {
  const sheet = workbook.getSheet(sheetId);
  const data = [];

  // Convert sheet data to your format
  for (const [key, cell] of sheet.cells) {
    const { row, col } = parseCellKey(key);
    // Format conversion logic
  }

  return formatData(data);
}

export function importFromMyFormat(data: string, sheet: Sheet): void {
  // Parse data and populate sheet
  const parsedData = parseMyFormat(data);

  parsedData.forEach((rowData, rowIndex) => {
    rowData.forEach((cellValue, colIndex) => {
      if (cellValue !== null && cellValue !== undefined) {
        sheet.setCellValue(rowIndex, colIndex, cellValue);
      }
    });
  });
}
```

### Export Integration

Add export methods to workbook:

```typescript
// In workbook.ts
exportToMyFormat(sheetId?: string): string {
  return exportToMyFormat(this, sheetId);
}

importFromMyFormat(data: string, sheetId?: string): void {
  const sheet = this.getSheet(sheetId);
  importFromMyFormat(data, sheet);
  this.events.emit('sheetChange', { sheetId });
}
```

## Adding New Collaboration Providers

### Provider Implementation

Implement the CollaborationProvider interface:

```typescript
// packages/sheets-core/src/collaboration/my-provider.ts
export class MyCollaborationProvider implements CollaborationProvider {
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  async connect(workbookId: string): Promise<void> {
    // Establish connection to your backend
    await this.connectToMyService(workbookId);
    this.setupEventListeners();
  }

  disconnect(): void {
    // Clean up connections
    this.disconnectFromMyService();
    this.handlers.clear();
  }

  on(event: 'change' | 'presence' | 'cursor', handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit(event: 'change' | 'presence' | 'cursor', data: unknown): void {
    // Send data to your backend
    this.sendToMyService(event, data);
  }

  getPresences(): Presence[] {
    // Return current user presences
    return this.currentPresences;
  }

  private setupEventListeners(): void {
    // Listen for remote changes from your backend
    this.myService.on('remoteChange', (operation: CollaborationOperation) => {
      this.notifyHandlers('change', operation);
    });

    this.myService.on('presenceUpdate', (presence: Presence) => {
      this.notifyHandlers('presence', presence);
    });
  }

  private notifyHandlers(event: string, data: unknown): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in collaboration handler:', error);
        }
      }
    }
  }
}
```

### Operation Transformation

For advanced collaboration, implement operational transformation:

```typescript
private transformOperation(
  localOp: CollaborationOperation,
  remoteOp: CollaborationOperation
): CollaborationOperation {
  // Transform operations to handle conflicts
  if (this.isConcurrent(localOp, remoteOp)) {
    return this.resolveConflict(localOp, remoteOp);
  }
  return localOp;
}
```

## Customizing Rendering

### Extending CanvasRenderer

Add custom rendering by extending the canvas renderer:

```typescript
// packages/sheets-core/src/canvas/my-renderer.ts
export class MyCustomRenderer extends CanvasRenderer {
  renderCustomElements(ctx: CanvasRenderingContext2D, state: RenderState): void {
    // Custom rendering logic
    // Draw additional visual elements
  }

  // Override render method to include custom elements
  render(): void {
    super.render();

    // Add custom rendering after base rendering
    this.renderCustomElements(this.ctx, this.renderState);
  }
}
```

### Custom Cell Renderers

Implement custom cell rendering:

```typescript
// Custom cell renderer for special data types
export class CustomCellRenderer extends CellRenderer {
  renderCell(
    ctx: CanvasRenderingContext2D,
    cell: Cell | undefined,
    bounds: Rect,
    style: CellStyle | undefined,
    format: CellFormat | undefined
  ): void {
    // Check if this is a custom cell type
    if (this.isCustomCell(cell)) {
      this.renderCustomCell(ctx, cell, bounds, style, format);
    } else {
      // Use default rendering
      super.renderCell(ctx, cell, bounds, style, format);
    }
  }

  private renderCustomCell(
    ctx: CanvasRenderingContext2D,
    cell: Cell,
    bounds: Rect,
    style: CellStyle | undefined,
    format: CellFormat | undefined
  ): void {
    // Custom rendering logic
    // Draw icons, special formatting, etc.
  }
}
```

### Theme Customization

Extend the canvas theme:

```typescript
const customTheme: CanvasTheme = {
  ...DEFAULT_THEME,

  // Custom colors
  gridLineColor: '#e0e0e0',
  cellBackgroundColor: '#fafafa',
  selectionColor: 'rgba(0, 123, 255, 0.2)',

  // Custom fonts
  defaultFontFamily: 'Inter, sans-serif',
  defaultFontSize: 13,
};
```

## Adding New Cell Formats

### Format Implementation

Implement custom number formatting:

```typescript
// packages/sheets-core/src/utils/format-utils.ts
export function formatCustom(value: CellValue, format: CellFormat): string {
  if (format.type === 'myCustomFormat') {
    // Implement custom formatting logic
    return formatMyCustomType(value, format);
  }

  // Fallback to existing formats
  return formatNumber(value, format);
}

function formatMyCustomType(value: CellValue, format: CellFormat): string {
  // Custom formatting implementation
  if (typeof value === 'number') {
    // Apply custom number formatting
    return value.toString() + ' custom';
  }
  return String(value);
}
```

### Format Registration

Add format support to the format pool:

```typescript
// In CellFormat interface
interface CellFormat {
  // ... existing properties
  myCustomFormat?: {
    prefix?: string;
    suffix?: string;
    precision?: number;
  };
}
```

## Extending React Components

### Custom Toolbar Buttons

Add custom toolbar functionality:

```typescript
// packages/sheets-react/src/components/Toolbar.tsx
interface ToolbarProps {
  // ... existing props
  onMyCustomAction?: () => void;
  myCustomState?: boolean;
}

// In toolbar render
{onMyCustomAction && (
  <button
    onClick={onMyCustomAction}
    className={myCustomState ? 'active' : ''}
  >
    My Custom Action
  </button>
)}
```

### Custom Context Menu Items

Extend context menus:

```typescript
// packages/sheets-react/src/components/ContextMenu.tsx
interface ContextMenuProps {
  // ... existing props
  onMyCustomAction?: () => void;
}

// Add to menu items
{menuItems.push(
  <MenuItem key="custom" onClick={onMyCustomAction}>
    My Custom Action
  </MenuItem>
)}
```

## Testing Extensions

### Unit Tests

Test new features thoroughly:

```typescript
// __tests__/my-feature.test.ts
describe('MyFeatureManager', () => {
  test('applies feature correctly', () => {
    const sheet = createMockSheet();
    const config = { /* test config */ };

    MyFeatureManager.applyFeature(sheet, config);

    expect(sheet.config.myFeature).toEqual(config);
  });

  test('handles edge cases', () => {
    // Test error conditions, invalid inputs, etc.
  });
});
```

### Integration Tests

Test feature integration:

```typescript
// __tests__/workbook-my-feature.test.ts
test('workbook integrates my feature', () => {
  const workbook = new WorkbookImpl('test', 'Test');

  workbook.applyMyFeature({ /* config */ });

  expect(workbook.getMyFeatureState()).toBeDefined();
});
```

## Performance Considerations

### Memory Management

Be mindful of memory usage in extensions:

```typescript
// Use object pooling for frequently created objects
const objectPool = new Map<string, MyObject>();

function getPooledObject(key: string): MyObject {
  if (objectPool.has(key)) {
    return objectPool.get(key)!;
  }

  const obj = new MyObject();
  objectPool.set(key, obj);
  return obj;
}
```

### Lazy Loading

Load extensions on demand:

```typescript
// Dynamic import for large extensions
export async function loadMyExtension(): Promise<MyExtension> {
  const { MyExtension } = await import('./my-extension');
  return new MyExtension();
}
```

## Documentation

### Update Documentation

Keep documentation current when adding extensions:

1. **Overview**: Update architecture diagrams if needed
2. **API Reference**: Document new methods and interfaces
3. **Examples**: Provide usage examples
4. **Migration Guide**: Document breaking changes

### Code Comments

Document extension points clearly:

```typescript
/**
 * Custom cell renderer hook
 *
 * Override this method to provide custom cell rendering.
 * Called for each cell during the render cycle.
 *
 * @param ctx Canvas rendering context
 * @param cell Cell data (may be undefined for empty cells)
 * @param bounds Cell bounds in canvas coordinates
 * @param style Resolved cell style
 * @param format Resolved cell format
 * @returns true if custom rendering was performed, false to use default
 */
protected renderCustomCell(
  ctx: CanvasRenderingContext2D,
  cell: Cell | undefined,
  bounds: Rect,
  style: CellStyle | undefined,
  format: CellFormat | undefined
): boolean {
  // Custom rendering logic
  return false; // Return false to use default rendering
}
```

## Contributing Guidelines

### Code Style

Follow existing patterns:

- Use TypeScript strict mode
- Follow existing naming conventions
- Use JSDoc comments for public APIs
- Include comprehensive error handling
- Write tests for all new functionality

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your extension
4. **Add tests** and documentation
5. **Submit** a pull request with detailed description
6. **Address** review feedback

### Breaking Changes

For breaking changes:

1. Update migration documentation
2. Provide upgrade guides
3. Consider deprecation warnings
4. Update examples and demos

This guide provides the foundation for extending Spindle while maintaining code quality and architectural consistency.

import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// Two entry points:
//   .          → core slides engine (no Yjs dep for non-collab consumers)
//   ./collab   → Yjs-backed collaboration binding
//
// Only the main entry emits .d.ts files (tsc walks every reachable source
// file when generating declarations, so dist/collab/*.d.ts come out of the
// main pass). The collab pass uses declaration: false to avoid clobbering
// dist/collab/index.d.ts with the main entry's types.

const tsPluginMain = typescript({
  tsconfig: './tsconfig.json',
  declaration: true,
  declarationDir: './dist',
  rootDir: './src',
});
const tsPluginNoDecl = typescript({
  tsconfig: './tsconfig.json',
  declaration: false,
});

const external = [
  'yjs',
  'y-protocols',
  'y-protocols/awareness',
  'y-protocols/sync',
  'y-indexeddb',
  'y-prosemirror',
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-transform',
  'lib0/encoding',
  'lib0/decoding',
];

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins: [tsPluginMain],
  },
  {
    input: 'src/collab/index.ts',
    output: [
      { file: 'dist/collab/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/collab/index.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins: [tsPluginNoDecl],
  },
]);

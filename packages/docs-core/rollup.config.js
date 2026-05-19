import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// Two entry points:
//   .          → core document engine (no Yjs dep pulled in for consumers
//                who don't use collab).
//   ./collab   → Yjs-backed collaboration binding. Pulls in yjs / y-protocols.

const tsPlugin = (declarationDir) =>
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir,
    rootDir: './src',
  });

const external = ['immer', 'yjs', 'y-protocols', 'y-protocols/awareness'];

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins: [tsPlugin('./dist')],
  },
  {
    input: 'src/collab/index.ts',
    output: [
      { file: 'dist/collab/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/collab/index.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins: [tsPlugin('./dist/collab')],
  },
]);

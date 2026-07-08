import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';

// The docs and the live demos each live in their own chunk; the landing
// page never pays for them.
const DocsApp = lazy(() => import('./docs/DocsApp'));
const SheetsDemo = lazy(() => import('./demo/SheetsDemo'));
const DocsDemo = lazy(() => import('./demo/DocsDemo'));
const SlidesDemo = lazy(() => import('./demo/SlidesDemo'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/docs/*"
          element={
            <Suspense fallback={<div className="docs-boot">Loading docs…</div>}>
              <DocsApp />
            </Suspense>
          }
        />
        <Route
          path="/demo/sheets"
          element={
            <Suspense fallback={<div className="docs-boot">Loading the sheets demo…</div>}>
              <SheetsDemo />
            </Suspense>
          }
        />
        <Route
          path="/demo/docs"
          element={
            <Suspense fallback={<div className="docs-boot">Loading the docs demo…</div>}>
              <DocsDemo />
            </Suspense>
          }
        />
        <Route
          path="/demo/slides"
          element={
            <Suspense fallback={<div className="docs-boot">Loading the slides demo…</div>}>
              <SlidesDemo />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

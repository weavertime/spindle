import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';

// The docs live in their own chunk — the landing page never pays for them.
const DocsApp = lazy(() => import('./docs/DocsApp'));

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
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

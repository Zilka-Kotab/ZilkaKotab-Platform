import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';

import './index.css';

const rootEl = document.getElementById('root')!;

// Use hydrateRoot when the element already has pre-rendered HTML (static build),
// otherwise fall back to createRoot for the dev server.
if (rootEl.innerHTML.trim()) {
  hydrateRoot(rootEl, <App />);
} else {
  createRoot(rootEl).render(<App />);
}

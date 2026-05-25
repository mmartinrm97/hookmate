import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initDarkMode } from './stores/ui-store.js';
import './index.css';
import App from './App.js';

// Apply dark mode before first render to avoid flash
initDarkMode({
  darkMode:
    localStorage.getItem('hookmate-dark-mode') === 'true' ||
    window.matchMedia('(prefers-color-scheme: dark)').matches,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

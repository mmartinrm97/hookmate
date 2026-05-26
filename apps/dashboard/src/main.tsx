import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initDarkMode } from './stores/ui-store';

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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';
import { watchSystemTheme } from './store/theme';

watchSystemTheme();

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import App from './App';
import { ThemeColorSync } from './components/ThemeColorSync';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark', 'mid-light', 'mid-dark']}
      storageKey="admin-theme"
    >
      <ThemeColorSync />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

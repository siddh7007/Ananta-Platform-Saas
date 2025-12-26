import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeAdminToken } from './config/api';

// Initialize admin token BEFORE rendering app
// Critical for private browsing mode - ensures token is always available
initializeAdminToken();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

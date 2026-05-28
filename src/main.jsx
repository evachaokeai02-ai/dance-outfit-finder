import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.__APP_BOOTSTRAPPED__ = true;
const fallback = document.getElementById('boot-fallback');
if (fallback) fallback.remove();

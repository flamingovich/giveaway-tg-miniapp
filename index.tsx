import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminApp } from './components/AdminApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
const path = window.location.pathname.replace(/\/$/, '') || '/';

if (path === '/adminka777') {
  root.render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

import { createRoot } from 'react-dom/client';

import AdminApp from './AdminApp';
import PublicCatalogue from './PublicCatalogue';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const path = window.location.pathname;
const isAdminRoute = path.startsWith('/admin');

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isAdminRoute ? <AdminApp /> : <PublicCatalogue />}
  </ErrorBoundary>,
);

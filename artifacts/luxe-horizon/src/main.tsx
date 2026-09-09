import { createRoot } from 'react-dom/client';

import App from './App';
import PublicCatalogue from './PublicCatalogue';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const path = window.location.pathname;
const isPublicCatalogueRoute = path === '/' || path === '/catalogue' || path.startsWith('/catalogue/product/');

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isPublicCatalogueRoute ? <PublicCatalogue /> : <App />}
  </ErrorBoundary>,
);

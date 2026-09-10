import { createRoot } from 'react-dom/client';

import App from './App';
import AdminApp from './AdminApp';
import AdminFastPages from './AdminFastPages';
import AppearanceToggle from './AppearanceToggle';
import PublicCatalogue from './PublicCatalogue';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const path = window.location.pathname;
const isPublicCatalogueRoute = path === '/' || path === '/catalogue' || path.startsWith('/catalogue/product/');
const isAdminRoute = path.startsWith('/admin');
const isFastAdminRoute = path === '/admin/review' || path === '/admin/products';

// Keep the admin and catalogue browser identity on the official Luxe Horizon favicon.
document.title = isAdminRoute ? 'Luxe Horizon Admin' : 'Luxe Horizon';
const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = `/favicon.svg?v=official-6${isAdminRoute ? '-admin' : '-catalogue'}`;

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isPublicCatalogueRoute ? <PublicCatalogue /> : isFastAdminRoute ? <AdminFastPages /> : isAdminRoute ? <AdminApp /> : <App />}
    {isAdminRoute && <AppearanceToggle />}
  </ErrorBoundary>,
);

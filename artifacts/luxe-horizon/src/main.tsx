import { createRoot } from 'react-dom/client';

import App from './App';
import AdminApp from './AdminApp';
import AdminFastPages from './AdminFastPages';
import AdminUploadFast from './AdminUploadFast';
import AppearanceToggle from './AppearanceToggle';
import PublicCatalogue from './PublicCatalogue';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './qa-fixes.css';

const path = window.location.pathname;
const isPublicProductRoute = path.startsWith('/catalogue/product/') || path.startsWith('/product/');
const isPublicCatalogueRoute = path === '/' || path === '/catalogue' || isPublicProductRoute;
const isAdminRoute = path.startsWith('/admin');
const isFastAdminRoute = path === '/admin/review' || path === '/admin/products';
const isFastUploadRoute = path === '/admin/upload';

document.documentElement.dataset.appRoute = isAdminRoute ? 'admin' : 'catalogue';
document.title = isAdminRoute ? 'Luxe Horizon Admin' : 'Luxe Horizon';
const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = `/favicon.svg?v=official-10${isAdminRoute ? '-admin' : '-catalogue'}`;

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isPublicCatalogueRoute ? <PublicCatalogue /> : isFastUploadRoute ? <AdminUploadFast /> : isFastAdminRoute ? <AdminFastPages /> : isAdminRoute ? <AdminApp /> : <App />}
    {isAdminRoute && <AppearanceToggle />}
  </ErrorBoundary>,
);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/latin.css';
import './i18n';
import './index.css';
import App from './App';
import { loadFullFonts } from './i18n/fonts';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// The landing page loads the rest on first scroll; every other screen needs the rupee sign now.
if (window.location.pathname !== '/') void loadFullFonts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

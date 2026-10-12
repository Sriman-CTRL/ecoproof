import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Page } from './components/ui';
import { api } from './lib/api';
import { getSession } from './lib/session';
import ActionDetail from './pages/ActionDetail';
import Actions from './pages/Actions';
import Confirm from './pages/Confirm';
import Consent from './pages/Consent';
import Health from './pages/Health';
import Home from './pages/Home';
import NewBill from './pages/NewBill';
import Results from './pages/Results';
import Start from './pages/Start';

/** Everything except /start needs a demo login. */
function RequireSession() {
  return getSession() ? <Outlet /> : <Navigate to="/start" replace />;
}

/** Nothing else is reachable without a "processing" consent (DPDP). */
function RequireConsent() {
  const { t } = useTranslation();
  const status = useQuery({
    queryKey: ['consent'],
    queryFn: () => api<{ processing: boolean; noticeVersion?: string }>('/consents/status'),
  });
  if (status.isLoading) {
    return (
      <Page>
        <p>{t('common.loading')}</p>
      </Page>
    );
  }
  if (status.isError) {
    return (
      <Page>
        <p role="alert">{t('common.networkError')}</p>
        <button className="min-h-12 underline" onClick={() => void status.refetch()}>
          {t('common.retry')}
        </button>
      </Page>
    );
  }
  return status.data?.processing ? <Outlet /> : <Navigate to="/consent" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/start" element={<Start />} />
        <Route element={<RequireSession />}>
          <Route path="/consent" element={<Consent />} />
          <Route element={<RequireConsent />}>
            <Route path="/home" element={<Home />} />
            <Route path="/bills/new" element={<NewBill />} />
            <Route path="/bills/:documentId/confirm" element={<Confirm />} />
            <Route path="/results/:resultId" element={<Results />} />
            <Route path="/health" element={<Health />} />
            <Route path="/actions" element={<Actions />} />
            <Route path="/actions/:code" element={<ActionDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

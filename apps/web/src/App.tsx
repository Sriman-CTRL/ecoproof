import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Button } from './components/kit/Button';
import { Skeleton } from './components/kit/Skeleton';
import { ErrorBox, Page } from './components/ui';
import { api } from './lib/api';
import { getSession, isHousehold } from './lib/session';

// Every route is its own chunk, so the landing page and the owner app load only what they show.
const ActionDetail = lazy(() => import('./pages/ActionDetail'));
const Actions = lazy(() => import('./pages/Actions'));
const Bills = lazy(() => import('./pages/Bills'));
const Carbon = lazy(() => import('./pages/Carbon'));
const CbamNew = lazy(() => import('./pages/CbamNew'));
const Confirm = lazy(() => import('./pages/Confirm'));
const Consent = lazy(() => import('./pages/Consent'));
const Health = lazy(() => import('./pages/Health'));
const Home = lazy(() => import('./pages/Home'));
const HouseholdAfter = lazy(() => import('./pages/HouseholdAfter'));
const HouseholdHome = lazy(() => import('./pages/HouseholdHome'));
const HouseholdSolar = lazy(() => import('./pages/HouseholdSolar'));
const Landing = lazy(() => import('./pages/Landing'));
const NewBill = lazy(() => import('./pages/NewBill'));
const Progress = lazy(() => import('./pages/Progress'));
const Report = lazy(() => import('./pages/Report'));
const Reports = lazy(() => import('./pages/Reports'));
const Results = lazy(() => import('./pages/Results'));
const ShareView = lazy(() => import('./pages/ShareView'));
const Savings = lazy(() => import('./pages/Savings'));
const Schemes = lazy(() => import('./pages/Schemes'));
const Start = lazy(() => import('./pages/Start'));
const Verify = lazy(() => import('./pages/Verify'));
// Public website pages (D6b).
const SiteAbout = lazy(() => import('./pages/site/About'));
const SiteCarbonMethod = lazy(() => import('./pages/site/CarbonMethod'));
const SiteForBuyers = lazy(() => import('./pages/site/ForBuyers'));
const SiteForHomes = lazy(() => import('./pages/site/ForHomes'));
const SiteForLenders = lazy(() => import('./pages/site/ForLenders'));
const SiteHowItWorks = lazy(() => import('./pages/site/HowItWorks'));

/** Design kit preview: dev server only, so it is dropped from the production build. */
const DevKit = import.meta.env.DEV ? lazy(() => import('./pages/DevKit')) : null;

/** Shown while a route's chunk loads. */
function RouteFallback() {
  return (
    <div className="mx-auto max-w-[480px] p-4">
      <Skeleton />
    </div>
  );
}

/** Everything except /start and the public verify and share pages needs a demo login. */
function RequireSession() {
  return getSession() ? <Outlet /> : <Navigate to="/start" replace />;
}

/** HH-1: a household gets its own home (bill, units, CO2, solar plan). */
function HomeRoute() {
  return isHousehold() ? <HouseholdHome /> : <Home />;
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
        <Skeleton />
      </Page>
    );
  }
  if (status.isError) {
    return (
      <Page>
        <ErrorBox>{t('common.networkError')}</ErrorBox>
        <Button variant="secondary" onClick={() => void status.refetch()}>
          {t('common.retry')}
        </Button>
      </Page>
    );
  }
  return status.data?.processing ? <Outlet /> : <Navigate to="/consent" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works" element={<SiteHowItWorks />} />
          <Route path="/carbon-method" element={<SiteCarbonMethod />} />
          <Route path="/for-lenders" element={<SiteForLenders />} />
          <Route path="/for-buyers" element={<SiteForBuyers />} />
          <Route path="/for-homes" element={<SiteForHomes />} />
          <Route path="/about" element={<SiteAbout />} />
          <Route path="/start" element={<Start />} />
          {DevKit && <Route path="/dev/kit" element={<DevKit />} />}
          {/* Public: no login, no consent gate (a lender scanning the QR code). */}
          <Route path="/verify/:reportId" element={<Verify />} />
          <Route path="/s/:token" element={<ShareView />} />
          <Route element={<RequireSession />}>
            <Route path="/consent" element={<Consent />} />
            <Route element={<RequireConsent />}>
              <Route path="/home" element={<HomeRoute />} />
              <Route path="/household/solar" element={<HouseholdSolar />} />
              <Route path="/household/after" element={<HouseholdAfter />} />
              <Route path="/carbon" element={<Carbon />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/bills/new" element={<NewBill />} />
              <Route path="/bills/:documentId/confirm" element={<Confirm />} />
              <Route path="/results/:resultId" element={<Results />} />
              <Route path="/health" element={<Health />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/actions/:code" element={<ActionDetail />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/cbam/new" element={<CbamNew />} />
              <Route path="/reports/:id" element={<Report />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/schemes" element={<Schemes />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

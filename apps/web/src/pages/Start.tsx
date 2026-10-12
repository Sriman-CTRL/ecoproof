import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RupeeHero } from '../components/kit/RupeeHero';
import { SkeletonBlock } from '../components/kit/Skeleton';
import { YearStrip } from '../components/kit/YearStrip';
import { ErrorBox, monthLabel, Page, yearMonths } from '../components/ui';
import { api, postJson, type Insights, type MonthRow } from '../lib/api';
import { describeError } from '../lib/errors';
import { formatNumber } from '../lib/format';
import { setSession } from '../lib/session';

type Demo = 'A' | 'B' | 'H';

interface LoginResponse {
  token: string;
  org: { name: string; type: 'msme' | 'household' };
  site: { id: string };
}

/**
 * Real numbers for the envelope preview: a throw-away demo login (nothing is stored) and the same
 * endpoints Home uses. Nothing here is hard-coded.
 */
function useDemoPreview(demo: Demo) {
  return useQuery({
    queryKey: ['start-preview', demo],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const login = await postJson<LoginResponse>('/auth/demo-login', { demo });
      const init = { headers: { Authorization: `Bearer ${login.token}` } };
      const months = await api<MonthRow[]>(`/sites/${login.site.id}/months`, init);
      const insights =
        demo === 'A' ? await api<Insights>(`/sites/${login.site.id}/insights`, init) : null;
      return {
        months,
        atStake: insights?.atStake.inrPerMonth ?? null,
        atStakeMonth: insights?.month ?? null,
        billTotal: months[0]?.rupees.total ?? null,
      };
    },
  });
}

function Envelope({
  demo,
  title,
  desc,
  disabled,
  onOpen,
}: {
  demo: Demo;
  title: string;
  desc: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const preview = useDemoPreview(demo);
  const p = preview.data;
  const value = demo === 'A' ? p?.atStake : p?.billTotal;
  // The figure is for one bill: say which, so it does not seem to contradict the result screen.
  const lang = i18n.resolvedLanguage ?? 'en';
  const billMonth = demo === 'A' ? p?.atStakeMonth : p?.months[0]?.month;
  const month = billMonth ? monthLabel(billMonth, lang) : '';
  return (
    <div className="relative space-y-3 rounded-card border-2 border-green-700 bg-surface p-4 shadow-card">
      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="min-h-12 text-left font-heading text-card-title font-semibold after:absolute after:inset-0 after:content-[''] disabled:opacity-60"
        >
          {title}
        </button>
        <p className="text-small text-ink-muted">{desc}</p>
      </div>
      <div className="space-y-3 rounded-card border border-dashed bg-paper p-3">
        {preview.isLoading && (
          <div role="status" aria-busy="true">
            <SkeletonBlock className="h-8 w-1/2" />
            <SkeletonBlock className="mt-2 h-8 w-full" />
          </div>
        )}
        {preview.isError && <p className="text-small text-ink-muted">{t('start.previewFailed')}</p>}
        {p && value != null && (
          <RupeeHero
            size="mini"
            value={Math.round(value)}
            label={t(demo === 'A' ? 'start.previewAtStake' : 'start.previewBill', { month })}
          />
        )}
        {/* A home before R9 has kWh but no rupees: show the units, never an invented figure. */}
        {p && value == null && p.months[0]?.kwh != null && (
          <p className="num font-heading text-card-title font-semibold">
            {t('start.previewUnits', { month, kwh: formatNumber(p.months[0].kwh) })}
          </p>
        )}
        {p && <YearStrip months={yearMonths(p.months, lang)} showBaseline={demo !== 'H'} />}
      </div>
    </div>
  );
}

export default function Start() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: (demo: Demo) =>
      postJson<LoginResponse>('/auth/demo-login', { demo }).then((r) => ({ r, demo })),
    onSuccess: ({ r, demo }) => {
      qc.clear();
      setSession({
        token: r.token,
        siteId: r.site.id,
        orgName: r.org.name,
        demo,
        orgType: r.org.type,
      });
      // The route guard sends people without consent to /consent.
      navigate('/home');
    },
  });

  const cards: Array<{ demo: Demo; title: string; desc: string }> = [
    { demo: 'A', title: t('start.demoA'), desc: t('start.demoADesc') },
    { demo: 'B', title: t('start.demoB'), desc: t('start.demoBDesc') },
    { demo: 'H', title: t('start.demoH'), desc: t('start.demoHDesc') },
  ];

  return (
    <Page showBusiness={false}>
      <h1 className="font-heading text-title font-semibold">{t('start.title')}</h1>
      <p className="text-ink-muted">{t('start.intro')}</p>
      <p className="text-small font-semibold text-copper-800">{t('common.sampleLabel')}</p>
      {login.isError && <ErrorBox>{t('start.failed')}</ErrorBox>}
      <div className="space-y-3">
        {cards.map((c) => (
          <Envelope
            key={c.demo}
            demo={c.demo}
            title={c.title}
            desc={c.desc}
            disabled={login.isPending}
            onOpen={() => login.mutate(c.demo)}
          />
        ))}
      </div>
      {login.isError && (
        <p className="text-small text-ink-muted">{describeError(login.error, t)}</p>
      )}
    </Page>
  );
}

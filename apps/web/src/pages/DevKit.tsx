import { useEffect, useMemo, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
// Synthetic sample bill (Demo A); dev-only page, so it never ships in the build.
import billUrl from '../../../api/prisma/demo/bills/bill-2026-10-clean.png?url';
import { loadScriptFonts } from '../i18n/fonts';
import { formatDecimal, formatNumber } from '../lib/format';
import {
  BillStubCard,
  Button,
  Card,
  DataQualityRing,
  EmiVsSavingBar,
  EmptyState,
  ErrorNote,
  HeadroomMeter,
  JargonChip,
  ProgressPath,
  RupeeHero,
  Skeleton,
  SourceChip,
  StampBadge,
  StatusPill,
  StickyPrimaryBar,
  YearStrip,
  type JargonTerm,
} from '../components/kit';

/**
 * Developer preview of the design kit (only routed in dev). Demo A sample figures (synthetic):
 * Rs 1,00,000 at stake, PF finding Rs 60,000, EMI 20,276 vs saving 60,000, 8 of 12 months.
 */
const DEMO = {
  atStake: 100_000,
  pf: 60_000,
  demand: 40_000,
  emi: 20_276,
  saving: 60_000,
  kwh: 92_000,
  /** Seeded CEA grid factor, t CO2 per MWh (see docs/OPEN_ITEMS.md). */
  gridFactor: 0.727,
  quality: 92,
};

const MONTHS = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];
const JARGON: JargonTerm[] = [
  'kvah',
  'powerFactor',
  'maximumDemand',
  'contractedDemand',
  'peakHours',
];

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-small text-ink-muted">{name}</p>
      {children}
    </div>
  );
}

function KitSection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'te' ? 'te-IN' : 'en-IN';
  const months = MONTHS.map((m, i) => ({
    label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${m}-01T00:00:00Z`),
    ),
    confirmed: i >= 4,
  }));
  return (
    <section lang={i18n.language} className="space-y-3">
      <h2 className="text-title font-semibold">
        {t(i18n.language === 'te' ? 'kit.demo.telugu' : 'kit.demo.english')}
      </h2>

      <Card>
        <Row name="RupeeHero">
          <RupeeHero
            label={t('kit.demo.atStake')}
            value={DEMO.atStake}
            unitsText={t('kit.demo.unitsLine', { units: formatNumber(DEMO.kwh) })}
            co2Text={t('kit.demo.co2Line', {
              tonnes: formatDecimal((DEMO.kwh * DEMO.gridFactor) / 1000),
            })}
            countUpKey={`devkit-${i18n.language}`}
          />
        </Row>
      </Card>

      <Row name="BillStubCard + SourceChip + JargonChip">
        <BillStubCard
          monthly={DEMO.pf}
          title={t('health.name.power_factor')}
          fix={t('health.fix.power_factor')}
        >
          <p className="text-small">
            <JargonChip term="powerFactor" />:{' '}
            <SourceChip
              lineName={t('fields.pf.label')}
              month={new Intl.DateTimeFormat(locale, {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date('2026-10-01T00:00:00Z'))}
              quality="fromBill"
              imageUrl={billUrl}
            >
              0.92
            </SourceChip>
          </p>
        </BillStubCard>
      </Row>
      <BillStubCard
        monthly={DEMO.demand}
        title={t('health.name.contracted_demand')}
        fix={t('health.fix.contracted_demand')}
      />

      <Card className="space-y-3">
        <Row name="JargonChip (all)">
          <ul className="space-y-2 text-body">
            {JARGON.map((j) => (
              <li key={j}>
                <JargonChip term={j} />
              </li>
            ))}
          </ul>
        </Row>
      </Card>

      <Card className="space-y-3">
        <Row name="StampBadge">
          <div className="flex flex-wrap gap-4 py-2">
            <StampBadge variant="verified" press />
            <StampBadge variant="early" />
            <StampBadge variant="estimate" />
          </div>
        </Row>
      </Card>

      <Card>
        <Row name="YearStrip">
          <YearStrip months={months} />
        </Row>
      </Card>

      <Card className="space-y-6">
        <Row name="EmiVsSavingBar">
          <EmiVsSavingBar emi={DEMO.emi} saving={DEMO.saving} />
        </Row>
        <Row name="EmiVsSavingBar (short)">
          <EmiVsSavingBar emi={70_000} saving={DEMO.saving} />
        </Row>
      </Card>

      <Card>
        <Row name="DataQualityRing">
          <div className="flex flex-wrap gap-6">
            <DataQualityRing percent={DEMO.quality} />
            <DataQualityRing percent={64} />
          </div>
        </Row>
      </Card>

      <Card>
        <Row name="ProgressPath">
          <ProgressPath currentStage={1} nextStep={t('kit.demo.pfFix')} />
        </Row>
      </Card>

      <Card>
        <Row name="HeadroomMeter">
          <HeadroomMeter found={DEMO.atStake} started={DEMO.pf} />
        </Row>
      </Card>

      <Card className="space-y-3">
        <Row name="StatusPill">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="positive">{t('kit.demo.pillDone')}</StatusPill>
            <StatusPill tone="check">{t('kit.demo.pillCheck')}</StatusPill>
            <StatusPill tone="neutral">{t('common.sampleBadge')}</StatusPill>
          </div>
        </Row>
        <Row name="Button (secondary, danger)">
          <div className="flex flex-col items-start gap-2">
            <Button variant="secondary">{t('kit.demo.secondary')}</Button>
            <Button variant="danger">{t('kit.demo.danger')}</Button>
          </div>
        </Row>
      </Card>

      <Row name="Skeleton">
        <Skeleton />
      </Row>
      <Row name="EmptyState">
        <EmptyState
          icon={Receipt}
          title={t('kit.demo.emptyTitle')}
          body={t('kit.demo.emptyBody')}
        />
      </Row>
      <Row name="ErrorNote">
        <ErrorNote what={t('kit.demo.errorWhat')} todo={t('kit.demo.errorDo')} />
      </Row>
    </section>
  );
}

export default function DevKit() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage === 'te' ? 'te' : 'en';
  const other = current === 'te' ? 'en' : 'te';
  // A separate instance per section, so both languages show at once without changing the saved choice.
  const first = useMemo(() => i18n.cloneInstance({ lng: current }), [i18n, current]);
  const second = useMemo(() => i18n.cloneInstance({ lng: other }), [i18n, other]);

  useEffect(() => {
    void loadScriptFonts('te');
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-paper">
      <header className="space-y-2 bg-green-900 px-4 py-3 text-white">
        <h1 className="text-title font-semibold">{t('kit.demo.title')}</h1>
        <p className="text-small text-green-200">{t('kit.demo.note')}</p>
        <div role="group" aria-label={t('language.label')} className="flex gap-2">
          {(['en', 'te'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={current === l}
              onClick={() => void i18n.changeLanguage(l)}
              className={`min-h-12 rounded-button border border-green-200 px-4 text-small font-semibold ${
                current === l ? 'bg-copper-500 text-green-900' : 'text-white'
              }`}
            >
              {l === 'en' ? 'EN' : 'తె'}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 space-y-8 p-4">
        <I18nextProvider i18n={first}>
          <KitSection />
        </I18nextProvider>
        <I18nextProvider i18n={second}>
          <KitSection />
        </I18nextProvider>
      </main>
      <StickyPrimaryBar>
        <Button>{t('kit.demo.pfFix')}</Button>
      </StickyPrimaryBar>
    </div>
  );
}

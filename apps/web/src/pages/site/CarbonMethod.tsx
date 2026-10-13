import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SourceChip } from '../../components/kit/SourceChip';
import { monthYear } from '../../components/site/content';
import { Band, PageHero, PublicLayout, SectionTitle } from '../../components/site/PublicLayout';
import { SampleSkeleton } from '../../components/site/SampleSkeleton';
import { formatDecimal, formatFactor, formatNumber } from '../../lib/format';
import { LOAN_EXAMPLE_CODE, usePublicSample, type PublicSample } from '../../lib/publicSample';

const t2 = (n: number) => formatDecimal(Math.round(n * 100) / 100);

function FormulaCard({
  title,
  formula,
  worked,
  note,
  testId,
}: {
  title: string;
  formula: string;
  worked?: ReactNode;
  note: string;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <li className="space-y-3 rounded-card border bg-surface p-4 shadow-card" data-testid={testId}>
      <h3 className="font-heading text-card-title font-semibold">{title}</h3>
      <div className="space-y-1">
        <p className="text-small text-ink-muted">{t('site.method.formula')}</p>
        <p className="rounded-button bg-paper px-3 py-2 font-mono text-small">{formula}</p>
      </div>
      {worked && (
        <div className="space-y-1">
          <p className="text-small text-ink-muted">{t('site.method.worked')}</p>
          <p className="num font-semibold text-green-700">{worked}</p>
        </div>
      )}
      <p className="text-small text-ink-muted">{note}</p>
    </li>
  );
}

function Formulas({ s }: { s: PublicSample }) {
  const { t } = useTranslation();
  const c = s.carbon;
  const grid = c.latestMonth.factor;
  // Worked lines exactly as the API wrote them for the latest bill (services/carbon.ts).
  const line = (needle: string) => c.method.lines.find((l) => l.includes(needle));
  const igbt = s.actions.find((a) => a.code === LOAN_EXAMPLE_CODE);
  const r = s.baselineRules;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      <FormulaCard
        testId="method-scope2"
        title={t('site.method.scope2.title')}
        formula={t('site.method.scope2.formula')}
        worked={
          grid && line('kWh x') ? (
            <SourceChip lineName={`${grid.source}${grid.page ? `, ${grid.page}` : ''}`}>
              {line('kWh x')}
            </SourceChip>
          ) : undefined
        }
        note={t('site.method.scope2.note')}
      />
      <FormulaCard
        testId="method-scope1"
        title={t('site.method.scope1.title')}
        formula={t('site.method.scope1.formula')}
        worked={line('L diesel')}
        note={t('site.method.scope1.note')}
      />
      <FormulaCard
        testId="method-intensity"
        title={t('site.method.intensity.title')}
        formula={t('site.method.intensity.formula')}
        worked={line('t of output')}
        note={t('site.method.intensity.note')}
      />
      <FormulaCard
        testId="method-action"
        title={t('site.method.action.title')}
        formula={t('site.method.action.formula')}
        worked={
          igbt?.co2 && igbt.kwhPerYearLow != null && igbt.kwhPerYearHigh != null && grid
            ? t('site.method.action.worked', {
                title: t(`actions.name.${igbt.code}`, { defaultValue: igbt.title }),
                kwhLow: formatNumber(Math.round(igbt.kwhPerYearLow)),
                kwhHigh: formatNumber(Math.round(igbt.kwhPerYearHigh)),
                factor: formatFactor(grid.value),
                tLow: t2(igbt.co2.tPerYearLow),
                tHigh: t2(igbt.co2.tPerYearHigh),
              })
            : undefined
        }
        note={t('site.method.action.note')}
      />
      <FormulaCard
        testId="method-verify"
        title={t('site.method.verify.title')}
        formula={t('site.method.verify.formula')}
        note={t('site.method.verify.note', {
          months: r.minMonthsForRegression,
          cv: r.maxCvRmsePct,
          nmbe: r.maxAbsNmbePct,
        })}
      />
    </ul>
  );
}

function FactorTable({ s }: { s: PublicSample }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-card border bg-surface">
      <table className="w-full min-w-[640px] text-left text-small" data-testid="method-factors">
        <thead className="bg-paper">
          <tr>
            {(['factor', 'value', 'version', 'valid', 'sourceCol'] as const).map((k) => (
              <th key={k} scope="col" className="px-3 py-2 font-semibold">
                {t(`site.method.factors.${k}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.factors.map((f) => (
            <tr key={f.id} className="border-t align-top">
              <td className="px-3 py-2 font-mono">{f.sourceType}</td>
              <td className="num px-3 py-2 whitespace-nowrap">
                {formatFactor(f.value)} {f.unit}
              </td>
              <td className="px-3 py-2">{f.version ?? '-'}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {f.validFrom
                  ? t('site.method.factors.from', { date: f.validFrom })
                  : t('site.method.factors.always')}
              </td>
              <td className="px-3 py-2">
                {f.source}
                {f.page ? `, ${f.page}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bullets({ title, keys, base }: { title: string; keys: string[]; base: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      <ul className="list-disc space-y-2 pl-5">
        {keys.map((k) => (
          <li key={k}>{t(`${base}.${k}`)}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CarbonMethod() {
  const { t, i18n } = useTranslation();
  const sample = usePublicSample();
  const s = sample.data;
  return (
    <PublicLayout>
      <PageHero title={t('site.method.title')} lead={t('site.method.lead')} />
      <Band defer={false}>
        {s ? (
          <>
            <p className="text-small font-semibold text-copper-800">
              {t('site.sampleTag', {
                month: monthYear(s.carbon.latestMonth.month, i18n.resolvedLanguage ?? 'en'),
              })}
            </p>
            <Formulas s={s} />
          </>
        ) : (
          <SampleSkeleton error={sample.isError} />
        )}
      </Band>
      <Band tone="surface">
        <div className="grid gap-8 md:grid-cols-2">
          <Bullets
            title={t('site.method.notCounted.title')}
            base="site.method.notCounted"
            keys={['embodied', 'transport', 'scope3', 'gases']}
          />
          <Bullets
            title={t('site.method.limits.title')}
            base="site.method.limits"
            keys={['grid', 'synthetic', 'household', 'self']}
          />
        </div>
      </Band>
      <Band>
        <SectionTitle>{t('site.method.factors.title')}</SectionTitle>
        {s ? (
          <>
            <FactorTable s={s} />
            <div className="space-y-2">
              <h3 className="font-heading text-card-title font-semibold">
                {t('site.method.lines')}
              </h3>
              <ul className="num space-y-1 font-mono text-small">
                {s.carbon.method.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <SampleSkeleton error={sample.isError} />
        )}
      </Band>
    </PublicLayout>
  );
}

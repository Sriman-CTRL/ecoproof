import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { StampBadge } from '../components/kit/StampBadge';
import { ErrorBox, Page } from '../components/ui';
import { ApiError, postJson } from '../lib/api';
import { useCnCodes, type CnCode } from '../lib/schemes';
import { getSession } from '../lib/session';

interface Row {
  key: number;
  query: string;
  cnCode: string | null;
  description: string;
  tonnes: string;
}

const blank = (key: number): Row => ({ key, query: '', cnCode: null, description: '', tonnes: '' });
const squash = (s: string) => s.replace(/\s+/g, '');
const inputClass = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body';
const positive = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const optional = (s: string) => (s.trim() === '' ? undefined : Number(s));

/** Out-of-scope codes are flagged before generating (R4: 7325 is proposed from 2028 only). */
function ScopeNote({ code }: { code: CnCode }) {
  const { t } = useTranslation();
  if (code.inScopeNow) return null;
  return (
    <p
      className="flex gap-2 rounded-card border border-copper-700 bg-copper-50 p-2 text-small text-copper-800"
      data-testid="scope-warning"
    >
      <Warning size={18} className="mt-px shrink-0" aria-hidden="true" />
      {t('cbam.notInScope')}
    </p>
  );
}

function ProductRow({
  row,
  codes,
  onChange,
  onRemove,
  index,
}: {
  row: Row;
  codes: CnCode[];
  onChange: (r: Row) => void;
  onRemove?: () => void;
  index: number;
}) {
  const { t } = useTranslation();
  const chosen = codes.find((c) => c.code === row.cnCode) ?? null;
  const q = row.query.trim().toLowerCase();
  const hits = q
    ? codes
        .filter(
          (c) => squash(c.code).startsWith(squash(q)) || c.description.toLowerCase().includes(q),
        )
        .slice(0, 6)
    : [];
  return (
    <Card className="space-y-2" data-testid="cbam-product">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold">{t('cbam.product', { n: index + 1 })}</h2>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex min-h-12 min-w-12 items-center justify-center text-ink-muted"
            aria-label={t('cbam.remove')}
          >
            <Trash size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {chosen ? (
        <div className="space-y-2">
          <p>
            <span className="font-mono font-semibold">{chosen.code}</span> · {chosen.description}
          </p>
          <ScopeNote code={chosen} />
          <button
            type="button"
            className="min-h-12 text-small font-semibold text-green-700 underline"
            onClick={() => onChange({ ...row, cnCode: null })}
          >
            {t('cbam.changeCode')}
          </button>
        </div>
      ) : (
        <label className="block">
          <span className="text-small font-semibold">{t('cbam.cnSearch')}</span>
          <input
            className={inputClass}
            value={row.query}
            inputMode="search"
            placeholder="7307"
            onChange={(e) => onChange({ ...row, query: e.target.value })}
            data-testid="cn-search"
          />
          <span className="mt-1 block text-small text-ink-muted">{t('cbam.cnHelp')}</span>
          {hits.length > 0 && (
            <ul className="mt-2 divide-y rounded-card border">
              {hits.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start p-2 text-left"
                    onClick={() => onChange({ ...row, cnCode: c.code, query: c.code })}
                  >
                    <span className="font-mono font-semibold">{c.code}</span>
                    <span className="text-small text-ink-muted">{c.description}</span>
                    {!c.inScopeNow && (
                      <span className="text-small text-copper-800">{t('cbam.notInScope')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
      )}
      <label className="block">
        <span className="text-small font-semibold">{t('cbam.description')}</span>
        <input
          className={inputClass}
          value={row.description}
          onChange={(e) => onChange({ ...row, description: e.target.value })}
          data-testid="cbam-description"
        />
      </label>
      <label className="block">
        <span className="text-small font-semibold">{t('cbam.tonnes')}</span>
        <input
          className={inputClass}
          inputMode="decimal"
          value={row.tonnes}
          onChange={(e) => onChange({ ...row, tonnes: e.target.value })}
          data-testid="cbam-tonnes"
        />
      </label>
    </Card>
  );
}

/** REP-2 create flow: products with owner-chosen CN codes, optional precursors, then Generate. */
export default function CbamNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const siteId = getSession()?.siteId ?? '';
  const codes = useCnCodes();
  const [rows, setRows] = useState<Row[]>([blank(0)]);
  const [pre, setPre] = useState({ pigIron: '', scrap: '', preConsumer: '' });

  const valid = rows.every((r) => r.cnCode && r.description.trim() && positive(r.tonnes) != null);

  const generate = useMutation({
    mutationFn: () =>
      postJson<{ reportId: string }>(`/sites/${siteId}/reports/cbam`, {
        products: rows.map((r) => ({
          cnCode: r.cnCode,
          description: r.description.trim(),
          tonnes: positive(r.tonnes),
        })),
        precursors: {
          pigIronTonnes: optional(pre.pigIron),
          scrapTonnes: optional(pre.scrap),
          preConsumerScrapPct: optional(pre.preConsumer),
        },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
      navigate(`/reports/${r.reportId}`);
    },
  });

  const update = (i: number) => (r: Row) => setRows(rows.map((x, j) => (j === i ? r : x)));

  return (
    <Page
      tab="reports"
      action={
        <Button
          disabled={!valid || generate.isPending}
          onClick={() => generate.mutate()}
          data-testid="cbam-generate"
        >
          {generate.isPending ? t('cbam.generating') : t('cbam.generate')}
        </Button>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('cbam.title')}</h1>
      <StampBadge variant="estimate" />
      <p>{t('cbam.intro')}</p>
      <p className="text-small text-ink-muted">{t('cbam.directOnly')}</p>
      {codes.isError && <ErrorBox>{t('common.networkError')}</ErrorBox>}
      {rows.map((r, i) => (
        <ProductRow
          key={r.key}
          index={i}
          row={r}
          codes={codes.data ?? []}
          onChange={update(i)}
          onRemove={rows.length > 1 ? () => setRows(rows.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {rows.length < 10 && (
        <Button
          variant="secondary"
          onClick={() => setRows([...rows, blank(Math.max(...rows.map((r) => r.key)) + 1)])}
        >
          <Plus size={20} aria-hidden="true" />
          {t('cbam.addProduct')}
        </Button>
      )}
      <details className="rounded-card border bg-surface p-4">
        <summary className="min-h-12 cursor-pointer font-semibold">{t('cbam.precursors')}</summary>
        <p className="mt-2 text-small text-ink-muted">{t('cbam.precursorsHelp')}</p>
        {(
          [
            ['pigIron', 'cbam.pigIron'],
            ['scrap', 'cbam.scrap'],
            ['preConsumer', 'cbam.preConsumer'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="mt-2 block">
            <span className="text-small font-semibold">{t(label)}</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={pre[k]}
              onChange={(e) => setPre({ ...pre, [k]: e.target.value })}
            />
          </label>
        ))}
      </details>
      {generate.isError && (
        <ErrorBox>
          {generate.error instanceof ApiError && generate.error.status === 404
            ? t('cbam.noBills')
            : t('common.genericError')}
        </ErrorBox>
      )}
    </Page>
  );
}

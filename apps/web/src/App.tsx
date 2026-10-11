import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n';
import { formatInr, formatNumber } from './lib/format';

export default function App() {
  const { t, i18n } = useTranslation();

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-bold">{t('app.title')}</h1>
      <p className="mt-1 text-gray-600">{t('app.tagline')}</p>

      <label className="mt-6 block text-sm font-medium" htmlFor="lang">
        {t('language.label')}
      </label>
      <select
        id="lang"
        className="mt-1 rounded border px-2 py-1"
        value={i18n.resolvedLanguage}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>

      <p className="mt-6">
        {t('placeholder.body')} {formatInr(100000)} ({formatNumber(10000000)})
      </p>
    </main>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ErrorBox, Page } from '../components/ui';
import { postJson } from '../lib/api';
import { describeError } from '../lib/errors';
import { setSession } from '../lib/session';

interface LoginResponse {
  token: string;
  org: { name: string };
  site: { id: string };
}

export default function Start() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: (demo: 'A' | 'B') =>
      postJson<LoginResponse>('/auth/demo-login', { demo }).then((r) => ({ r, demo })),
    onSuccess: ({ r, demo }) => {
      qc.clear();
      setSession({ token: r.token, siteId: r.site.id, orgName: r.org.name, demo });
      // The route guard sends people without consent to /consent.
      navigate('/home');
    },
  });

  const cards: Array<{ demo: 'A' | 'B'; title: string; desc: string }> = [
    { demo: 'A', title: t('start.demoA'), desc: t('start.demoADesc') },
    { demo: 'B', title: t('start.demoB'), desc: t('start.demoBDesc') },
  ];

  return (
    <Page showBusiness={false}>
      <h1 className="text-2xl font-bold">{t('start.title')}</h1>
      <p className="text-gray-700">{t('start.intro')}</p>
      <p className="text-xs font-medium text-amber-900">{t('common.sampleLabel')}</p>
      {login.isError && <ErrorBox>{t('start.failed')}</ErrorBox>}
      <div className="space-y-3">
        {cards.map((c) => (
          <button
            key={c.demo}
            type="button"
            disabled={login.isPending}
            onClick={() => login.mutate(c.demo)}
            className="block min-h-32 w-full rounded-2xl border-2 border-emerald-700 bg-white p-5 text-left active:bg-emerald-50 disabled:opacity-60"
          >
            <span className="block text-xl font-bold">{c.title}</span>
            <span className="mt-2 block text-gray-700">{c.desc}</span>
          </button>
        ))}
      </div>
      {login.isError && <p className="text-xs text-gray-500">{describeError(login.error, t)}</p>}
    </Page>
  );
}

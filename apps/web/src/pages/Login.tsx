import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { ErrorBox, Page } from '../components/ui';
import { api, postJson } from '../lib/api';
import { setSession } from '../lib/session';

/** Demo mode is always on tonight: no SMS is sent and the code is fixed (D89 A1). */
export const DEMO_OTP = '123456';
/** Placeholder number for "Fill sample number" (not a real subscriber). */
const SAMPLE_PHONE = '9000000000';

interface LoginResponse {
  token: string;
  org: { name: string; type: 'msme' | 'household'; onboardingDoneAt?: string | null };
  site: { id: string };
}

const digitsOnly = (s: string) => s.replace(/\D/g, '');
const phoneText = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [phoneIsSample, setPhoneIsSample] = useState(false);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const signIn = useMutation({
    // Any 10-digit number + 123456 opens the sample foundry (Demo A) through the demo login.
    mutationFn: () => postJson<LoginResponse>('/auth/demo-login', { demo: 'A' }),
    onSuccess: async (r) => {
      qc.clear();
      setSession({
        token: r.token,
        siteId: r.site.id,
        orgName: r.org.name,
        demo: 'A',
        orgType: r.org.type,
      });
      let done = r.org.onboardingDoneAt != null;
      try {
        const o = await api<{ done: boolean }>(`/sites/${r.site.id}/onboarding`);
        done = o.done;
      } catch {
        /* fall back to the login answer */
      }
      navigate(done ? '/home' : '/start/data', { state: { signedInNote: true } });
    },
  });

  const sendOtp = () => {
    setError(null);
    if (digitsOnly(phone).length !== 10) {
      setError(t('login.badPhone'));
      return;
    }
    setSent(true);
    setTimeout(() => boxes.current[0]?.focus(), 0);
  };

  const submit = () => {
    setError(null);
    if (otp.join('') !== DEMO_OTP) {
      setError(t('login.wrongOtp'));
      return;
    }
    signIn.mutate();
  };

  const setDigit = (i: number, v: string) => {
    const d = digitsOnly(v);
    if (d.length > 1) {
      // Pasted the whole code.
      const next = d.slice(0, 6).split('');
      setOtp([...next, ...Array(6 - next.length).fill('')]);
      boxes.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
  };

  return (
    <Page showBusiness={false}>
      <p className="font-heading text-small font-semibold uppercase tracking-wide text-green-700">
        {t('app.title')}
      </p>
      <h1 className="font-heading text-title font-semibold">{t('login.title')}</h1>
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (sent) submit();
            else sendOtp();
          }}
        >
          {!sent ? (
            <>
              <label className="block space-y-1">
                <span className="flex items-center gap-2 text-small font-semibold">
                  {t('login.phone')}
                  {phoneIsSample && (
                    <span className="rounded-chip bg-copper-50 px-2 text-small font-semibold text-copper-800">
                      {t('login.sampleTag')}
                    </span>
                  )}
                </span>
                <span className="flex min-h-12 items-center rounded-button border border-line bg-surface">
                  <span className="px-3 text-ink-muted">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={11}
                    value={phoneText(phone)}
                    onChange={(e) => {
                      setPhone(digitsOnly(e.target.value).slice(0, 10));
                      setPhoneIsSample(false);
                    }}
                    className="num min-h-12 w-full rounded-r-button bg-transparent px-2 text-body outline-none"
                    data-testid="login-phone"
                  />
                </span>
              </label>
              <button
                type="button"
                className="min-h-12 text-small text-green-700 underline underline-offset-4"
                onClick={() => {
                  setPhone(SAMPLE_PHONE);
                  setPhoneIsSample(true);
                }}
              >
                {t('login.fillSample')}
              </button>
              <Button type="submit">{t('login.sendOtp')}</Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="num text-small">
                  {t('login.codeSentTo', { phone: phoneText(phone) })}
                </p>
                <button
                  type="button"
                  className="min-h-12 text-small text-green-700 underline underline-offset-4"
                  onClick={() => {
                    setSent(false);
                    setOtp(Array(6).fill(''));
                    setError(null);
                  }}
                >
                  {t('login.changeNumber')}
                </button>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-small font-semibold">{t('login.otpLabel')}</legend>
                <div className="grid grid-cols-6 gap-2">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        boxes.current[i] = el;
                      }}
                      aria-label={t('login.otpDigit', { n: i + 1 })}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0)
                          boxes.current[i - 1]?.focus();
                      }}
                      className="num h-12 w-full rounded-button border border-line bg-surface text-center text-card-title font-semibold"
                      data-testid={`otp-${i}`}
                    />
                  ))}
                </div>
              </fieldset>
              <p
                className="rounded-card bg-copper-50 p-3 text-small text-copper-800"
                data-testid="demo-otp-note"
              >
                {t('login.demoNote')}
              </p>
              <Button type="submit" disabled={signIn.isPending}>
                {t('login.signIn')}
              </Button>
            </>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          {signIn.isError && <ErrorBox>{t('login.failed')}</ErrorBox>}
        </form>
      </Card>
      <Link
        to="/start"
        className="inline-flex min-h-12 items-center text-green-700 underline underline-offset-4"
      >
        {t('login.justLooking')}
      </Link>
    </Page>
  );
}

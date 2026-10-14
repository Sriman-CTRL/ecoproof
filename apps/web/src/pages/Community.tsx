import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { ChatsCircle } from '@phosphor-icons/react/dist/csr/ChatsCircle';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { SealCheck } from '@phosphor-icons/react/dist/csr/SealCheck';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { BUTTON_CLASS } from '../components/kit/Button';
import { CARD_CLASS } from '../components/kit/Card';
import { StatusPill } from '../components/kit/StatusPill';
import { Page } from '../components/ui';
import {
  FILTERS,
  PRIVATE_LABEL,
  ROLE_LABEL,
  SAMPLE_POSTS,
  TYPE_LABEL,
  findPrivateDetails,
  loadMyPosts,
  makeMyPost,
  saveMyPosts,
  type CommunityFilter,
  type CommunityPost,
  type CommunityRole,
  type CommunityType,
} from '../lib/community';
import { useMitraSummary } from '../lib/mitra';
import { actionTitle, useActions } from './Actions';

const ROLE_CLASS: Record<CommunityRole, string> = {
  owner: 'bg-green-50 text-green-700',
  ngo: 'bg-teal-50 text-teal-800',
  student: 'bg-amber-50 text-amber-800',
  expert: 'bg-slate-100 text-slate-700',
};
const CHIP =
  'inline-flex min-h-9 items-center gap-1 rounded-chip border px-3 text-small font-semibold transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700';
const CHIP_ON = 'border-green-700 bg-green-700 text-white hover:bg-green-700';
const CHIP_OFF = 'bg-surface text-ink';
const TYPES = Object.keys(TYPE_LABEL) as CommunityType[];

function RoleBadge({ role }: { role: CommunityRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-chip px-2 py-0.5 text-small font-semibold ${ROLE_CLASS[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function Highlighted({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const m of findPrivateDetails(text)) {
    parts.push(text.slice(at, m.start));
    parts.push(
      <mark key={m.start} className="rounded bg-copper-500 px-1 text-ink">
        {m.text}
      </mark>,
    );
    at = m.end;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function Composer({
  text,
  setText,
  type,
  setType,
  onPost,
}: {
  text: string;
  setText: (s: string) => void;
  type: CommunityType;
  setType: (t: CommunityType) => void;
  onPost: () => void;
}) {
  const [open, setOpen] = useState(false);
  const found = useMemo(() => findPrivateDetails(text), [text]);
  const expanded = open || text.length > 0;
  return (
    <section className={`${CARD_CLASS} space-y-3`} aria-label="Ask or share">
      <label htmlFor="community-text" className="block font-heading text-body font-semibold">
        Ask or share
      </label>
      <textarea
        id="community-text"
        value={text}
        rows={expanded ? 4 : 1}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask a question or share one thing that worked for you"
        className="block w-full resize-none rounded-button border bg-paper px-3 py-2 text-body hover:border-green-600"
        data-testid="community-text"
      />
      {found.length > 0 && (
        <div
          role="status"
          className="flex gap-3 rounded-button border border-copper-500 bg-copper-50 p-3 text-small text-copper-800"
          data-testid="community-warning"
        >
          <Lock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-semibold">
              This looks like your business details. Posts are public. Remove it or share a rough
              range (for example &lsquo;about 1 lakh a month&rsquo;).
            </p>
            <p className="break-words text-ink">
              <Highlighted text={text} />
            </p>
            <p>{[...new Set(found.map((f) => PRIVATE_LABEL[f.kind]))].join(', ')}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((tp) => (
          <button
            key={tp}
            type="button"
            aria-pressed={type === tp}
            onClick={() => setType(tp)}
            className={`${CHIP} ${type === tp ? CHIP_ON : CHIP_OFF}`}
          >
            {TYPE_LABEL[tp]}
          </button>
        ))}
        <button
          type="button"
          disabled={!text.trim()}
          onClick={onPost}
          className={`${BUTTON_CLASS.primary} ml-auto !w-auto min-w-28 hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700`}
          data-testid="community-post"
        >
          Post
        </button>
      </div>
    </section>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const [more, setMore] = useState(false);
  return (
    <article className={`${CARD_CLASS} space-y-3`} data-testid="community-post-card">
      <header className="flex flex-wrap items-center gap-2">
        <RoleBadge role={post.role} />
        <span className="rounded-chip border px-2 py-0.5 text-small font-semibold text-ink">
          {TYPE_LABEL[post.type]}
        </span>
        <span className="text-small text-ink-muted">{post.ago}</span>
        <span className="ml-auto">
          {post.sample ? (
            <StatusPill tone="neutral">Sample</StatusPill>
          ) : (
            <StatusPill tone="check">Only you can see this (demo)</StatusPill>
          )}
        </span>
      </header>
      <h2 className="font-heading text-body font-semibold">{post.title}</h2>
      <div>
        <p className={`text-body ${more ? '' : 'line-clamp-2'}`}>{post.body}</p>
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="mt-1 inline-flex min-h-9 items-center text-small font-semibold text-green-700 underline underline-offset-4 hover:text-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          {more ? 'Show less' : 'Read more'}
        </button>
      </div>
      {post.links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-ink-muted">Related in EcoProof</span>
          {post.links.map((l) => (
            <Link key={l.to + l.label} to={l.to} className={`${CHIP} ${CHIP_OFF}`}>
              {l.label}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      <div className="space-y-2 border-t pt-3">
        <p className="flex items-center gap-1 text-small text-ink-muted">
          <ChatsCircle size={16} aria-hidden="true" />
          {post.answers.length === 1 ? '1 answer' : `${post.answers.length} answers`}
        </p>
        {post.answers.map((a) => (
          <div
            key={a.text}
            className={`rounded-button bg-paper p-3 text-small ${
              a.helpful ? 'border-l-4 border-green-700' : ''
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <RoleBadge role={a.role} />
              {a.helpful && (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                  <CheckCircle size={16} weight="fill" aria-hidden="true" />
                  Marked helpful by the asker
                </span>
              )}
            </div>
            <p>{a.text}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function Happening() {
  const mitra = useMitraSummary();
  const actions = useActions(null, false);
  const { t } = useTranslation();
  const top = actions.data?.actions[0];
  const rows = [
    {
      to: '/mitra',
      head: 'Next free step',
      text: mitra.data?.next?.title ?? 'See the free steps',
    },
    {
      to: '/plan',
      head: 'Top action in your plan',
      text: top ? actionTitle(top, t) : 'See your plan',
    },
    { to: '/carbon', head: 'Your carbon page', text: 'See t CO2 (grid) + t CO2e (fuels)' },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.to}>
          <Link
            to={r.to}
            className="flex min-h-12 items-center justify-between gap-2 rounded-button border bg-surface px-3 py-2 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            <span>
              <span className="block text-small text-ink-muted">{r.head}</span>
              <span className="block text-small font-semibold">{r.text}</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-green-700" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const RULES = [
  'Be kind.',
  'No selling.',
  'No green claims without proof.',
  'Never share bills or account numbers.',
];
const COMING = [
  { icon: SealCheck, title: 'Checked expert and NGO profiles' },
  { icon: UsersThree, title: 'NGO volunteer moderators' },
  { icon: Microphone, title: 'Telugu voice posts' },
];

export default function Community() {
  const [mine, setMine] = useState<CommunityPost[]>(loadMyPosts);
  const [filter, setFilter] = useState<CommunityFilter>('all');
  const [text, setText] = useState('');
  const [type, setType] = useState<CommunityType>('question');
  const mitra = useMitraSummary();

  const all = useMemo(() => [...mine, ...SAMPLE_POSTS], [mine]);
  const shown = all.filter((p) => filter === 'all' || p.type === filter);
  const count = (f: CommunityFilter) => all.filter((p) => f === 'all' || p.type === f).length;
  const roles = new Set(SAMPLE_POSTS.map((p) => p.role)).size;
  const linked = new Set(SAMPLE_POSTS.flatMap((p) => p.links.map((l) => l.to))).size;

  const post = () => {
    if (!text.trim()) return;
    const next = [makeMyPost(type, text), ...mine];
    setMine(next);
    saveMyPosts(next);
    setText('');
    setFilter('all');
  };
  const firstStep = () => {
    const step = mitra.data?.next?.title;
    setType('update');
    setText(step ? `My first step: ${step}. ` : 'My first step: ');
    document.getElementById('community-text')?.focus();
  };

  return (
    <Page tab="community">
      <section className="rounded-card bg-green-900 p-4 text-white lg:p-6">
        <h1 className="font-heading text-title font-semibold">Green Community</h1>
        <p className="mt-1 text-body text-green-100">
          Ask, share and learn how factories cut carbon. Owners, NGOs, students and experts.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-small font-semibold">
          {[`${SAMPLE_POSTS.length} sample posts`, `${roles} roles`, `${linked} linked steps`].map(
            (s) => (
              <span key={s} className="rounded-chip bg-green-700 px-3 py-1">
                {s}
              </span>
            ),
          )}
        </div>
      </section>
      <p className="text-small text-ink-muted">
        Demo mode: these are sample posts. Your post is saved only in this browser.
      </p>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <nav aria-label="Filter posts" className="min-w-0 space-y-3 lg:sticky lg:top-4">
          <p className="hidden font-heading text-body font-semibold lg:block">
            Green Community: owners, NGOs, students and experts cutting carbon together
          </p>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
            {FILTERS.map((f) => (
              <li key={f.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`${CHIP} lg:flex lg:w-full lg:justify-between lg:rounded-button ${
                    filter === f.id ? CHIP_ON : CHIP_OFF
                  }`}
                >
                  {f.label}
                  <span className="num font-normal">{count(f.id)}</span>
                </button>
              </li>
            ))}
          </ul>
          <span className="hidden rounded-chip bg-green-50 px-3 py-1 text-small font-semibold text-green-700 lg:inline-block">
            SDG 13 Climate Action
          </span>
        </nav>

        <div className="min-w-0 space-y-4">
          <Composer text={text} setText={setText} type={type} setType={setType} onPost={post} />
          <button
            type="button"
            onClick={firstStep}
            className={`${CHIP} ${CHIP_OFF}`}
            data-testid="community-first-step"
          >
            Share your first step
          </button>
          <details className="group rounded-card border bg-surface p-3 lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-heading font-semibold focus-visible:outline-2 focus-visible:outline-green-700">
              Happening around you
              <CaretDown size={18} className="group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-2">
              <Happening />
            </div>
          </details>
          {shown.length === 0 ? (
            <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-3`}>
              <p>No posts here yet.</p>
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setType('question');
                  document.getElementById('community-text')?.focus();
                }}
                className={`${BUTTON_CLASS.primary} !w-auto hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700`}
              >
                Ask the first question
              </button>
            </div>
          ) : (
            shown.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="hidden space-y-2 lg:block">
            <h2 className="font-heading text-body font-semibold">Happening around you</h2>
            <Happening />
          </section>
          <section className={`${CARD_CLASS} space-y-2`}>
            <h2 className="font-heading text-body font-semibold">Community rules</h2>
            <ul className="list-disc space-y-1 pl-5 text-small">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-body font-semibold">Coming next</h2>
            {COMING.map(({ icon: IconCmp, title }) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-card border border-dashed bg-paper p-3 text-small text-ink-muted"
              >
                <IconCmp size={20} aria-hidden="true" />
                <span className="flex-1">{title}</span>
                <Lock size={16} aria-label="Locked" />
              </div>
            ))}
          </section>
        </aside>
      </div>
    </Page>
  );
}

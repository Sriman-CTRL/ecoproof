import { formatFactor, formatInr } from './format';
import { SAMPLE_BILL } from './sampleBill';

export type CommunityRole = 'owner' | 'ngo' | 'student' | 'expert';
export type CommunityType = 'question' | 'update' | 'help' | 'event';
export type CommunityFilter = 'all' | 'question' | 'update' | 'help' | 'event';

export const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: 'MSME owner',
  ngo: 'NGO volunteer',
  student: 'Student',
  expert: 'Energy expert',
};
export const TYPE_LABEL: Record<CommunityType, string> = {
  question: 'Question',
  update: 'Update',
  help: 'Help offered',
  event: 'Event',
};
export const FILTERS: Array<{ id: CommunityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'question', label: 'Questions' },
  { id: 'update', label: 'Updates' },
  { id: 'help', label: 'Help offered' },
  { id: 'event', label: 'Events' },
];

export interface CommunityAnswer {
  role: CommunityRole;
  text: string;
  helpful?: boolean;
}
export interface CommunityLink {
  to: string;
  label: string;
}
export interface CommunityPost {
  id: string;
  role: CommunityRole;
  type: CommunityType;
  title: string;
  body: string;
  ago: string;
  links: CommunityLink[];
  answers: CommunityAnswer[];
  /** true for the typed array below; false for a post written in this browser. */
  sample: boolean;
}

const pf = formatInr(SAMPLE_BILL.pfLossInr);
const demand = formatInr(SAMPLE_BILL.demandOverpayInr);
const grid = formatFactor(SAMPLE_BILL.carbon.grid.value);

/** Demo posts. Figures come from the sample bill (Demo A) and the grid factor row, nothing else. */
export const SAMPLE_POSTS: CommunityPost[] = [
  {
    id: 's1',
    role: 'owner',
    type: 'question',
    title: 'A power factor charge shows on every bill. Can it be fixed?',
    body: `The sample bill loses about Rs ${pf} a month to power factor. PF is kWh divided by kVAh, so a low PF means extra kVAh billed. What do other foundries do about it?`,
    ago: '2 hours ago',
    links: [
      { to: '/bills', label: 'Your bill check' },
      { to: '/plan', label: 'Power factor fix in your plan' },
    ],
    answers: [
      {
        role: 'expert',
        text: 'A capacitor bank sized to your load is the usual first fix. Read the PF line on three months of bills before you size it.',
        helpful: true,
      },
      {
        role: 'owner',
        text: 'We did this last year. The PF line on the bill improved within a month.',
      },
    ],
    sample: true,
  },
  {
    id: 's2',
    role: 'owner',
    type: 'question',
    title: 'Loan for an IGBT furnace: what will the lender look at?',
    body: 'We are planning an IGBT furnace and will ask for a loan. Which records should we keep ready, and what do lenders ask about energy?',
    ago: '5 hours ago',
    links: [{ to: '/plan', label: 'Furnace action in your plan' }],
    answers: [
      {
        role: 'expert',
        text: 'Keep 12 months of bills and the loan-ready summary at hand. The lender does their own assessment.',
      },
    ],
    sample: true,
  },
  {
    id: 's3',
    role: 'student',
    type: 'help',
    title: 'Final-year students can do a free walk-through of your unit',
    body: 'We can visit, note your main motors, furnace and lighting, and write down what we saw. It is a learning visit, not an energy audit. You decide what to share.',
    ago: 'Yesterday',
    links: [{ to: '/mitra/ngo', label: 'NGO Mitra: ask for a visit' }],
    answers: [{ role: 'owner', text: 'Which days do you visit? We shut on Sundays.' }],
    sample: true,
  },
  {
    id: 's4',
    role: 'owner',
    type: 'update',
    title: 'ZED pledge done: it took one evening',
    body: 'We finished the ZED pledge step. The form was shorter than I expected, and I saved a copy of the confirmation for later.',
    ago: 'Yesterday',
    links: [{ to: '/mitra/govt', label: 'Govt Mitra: ZED steps' }],
    answers: [],
    sample: true,
  },
  {
    id: 's5',
    role: 'ngo',
    type: 'event',
    title: 'RICH workshop for MSMEs on energy and carbon',
    body: 'A workshop for small manufacturers is open to owners and supervisors. Dates and the sign-up route are on the Govt Mitra page; you can ask there.',
    ago: '2 days ago',
    links: [{ to: '/mitra/govt', label: 'Govt Mitra: workshops' }],
    answers: [],
    sample: true,
  },
  {
    id: 's6',
    role: 'expert',
    type: 'help',
    title: 'How to read the carbon footprint statement',
    body: `Grid electricity uses the CEA factor of ${grid} t CO2 per MWh. Fuels such as diesel are added as t CO2e. The statement shows both, with the factor version used.`,
    ago: '3 days ago',
    links: [{ to: '/carbon', label: 'Your carbon page' }],
    answers: [
      {
        role: 'owner',
        text: 'This helped. I had been adding the two numbers into one total.',
        helpful: true,
      },
    ],
    sample: true,
  },
  {
    id: 's7',
    role: 'owner',
    type: 'question',
    title: 'Are we paying for contracted demand we never use?',
    body: `Our maximum demand stays below the contracted demand all year. The sample shows about Rs ${demand} a month above real use. How do others ask the DISCOM to review it?`,
    ago: '4 days ago',
    links: [{ to: '/plan', label: 'Contracted demand in your plan' }],
    answers: [
      {
        role: 'expert',
        text: 'Check 12 months of maximum demand first. If it is steady and low, you can ask the DISCOM about a lower contracted demand.',
      },
    ],
    sample: true,
  },
  {
    id: 's8',
    role: 'owner',
    type: 'question',
    title: 'My bill shows kVAh and kWh. Which one matters?',
    body: 'HT bills charge energy in kVAh, but I track kWh on the meter. Why are they different, and which should I watch every month?',
    ago: '5 days ago',
    links: [{ to: '/bills', label: 'Your bills' }],
    answers: [
      {
        role: 'student',
        text: 'kVAh is apparent energy. Divide kWh by kVAh to get the power factor.',
      },
    ],
    sample: true,
  },
];

// ---- privacy check -------------------------------------------------------------------

export type PrivateKind = 'consumer' | 'udyam' | 'gstin' | 'phone' | 'email' | 'amount';
export interface PrivateMatch {
  kind: PrivateKind;
  text: string;
  start: number;
  end: number;
}

export const PRIVATE_LABEL: Record<PrivateKind, string> = {
  consumer: 'consumer or service number',
  udyam: 'Udyam number',
  gstin: 'GSTIN',
  phone: 'phone number',
  email: 'email address',
  amount: 'exact amount',
};

// Order matters: earlier patterns win where two overlap.
const PATTERNS: Array<[PrivateKind, RegExp]> = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['udyam', /\bUDYAM-[A-Z]{2}-\d{2}-\d{4,10}\b/gi],
  ['gstin', /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi],
  [
    'consumer',
    /\b(?:consumer|service|usc|scno|sc|account)\s*(?:no\.?|number|#)?\s*[:-]?\s*\d[\d\s-]{4,}\d\b/gi,
  ],
  ['phone', /(?<![\d-])(?:(?:\+91|91|0)[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d-])/g],
  // "about 1 lakh" is a rough range and passes; "Rs 1,11,200" does not.
  [
    'amount',
    /(?:₹|\brs\.?|\binr)\s?\d[\d,]*(?:\.\d+)?(?!\s?(?:lakh|lakhs|crore|crores)\b)(?![\d,])/gi,
  ],
  ['amount', /\b\d[\d,]*(?:\.\d+)?\s?(?:rupees)\b/gi],
  ['amount', /\b\d[\d,]*(?:\.\d+)?\s?(?:kwh|kvah)\b/gi],
];

/** Flags details that identify a business or give exact figures. Pure; the post stays allowed. */
export function findPrivateDetails(text: string): PrivateMatch[] {
  const found: PrivateMatch[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ kind, text: m[0], start, end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// ---- posts written in this browser ------------------------------------------------------

const KEY = 'ecoproof.community.posts';

export function loadMyPosts(): CommunityPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CommunityPost[]).filter((p) => p && p.id) : [];
  } catch {
    return [];
  }
}

export function saveMyPosts(posts: CommunityPost[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(posts));
  } catch {
    /* private window or full storage: the post still shows until reload */
  }
}

export function makeMyPost(type: CommunityType, text: string): CommunityPost {
  const clean = text.trim();
  const first = clean.split(/[.?!\n]/)[0]!.trim();
  const title = first.length > 80 ? `${first.slice(0, 77)}...` : first;
  return {
    id: `me-${Date.now()}`,
    role: 'owner',
    type,
    title: title || TYPE_LABEL[type],
    body: clean,
    ago: 'Just now',
    links: [],
    answers: [],
    sample: false,
  };
}

/** D89 "Add your unit's data": API shapes for the wizard (apps/api/src/routes/onboarding.ts). */

export type CheckResult = 'pass' | 'flag' | 'cant_check';

export interface CheckItem {
  code: string;
  result: CheckResult;
  line: string;
}

export interface BusinessView {
  saved: boolean;
  level: 'none' | 'self_declared' | 'matched_documents';
  levelText: string;
  levelNumber: 0 | 1 | 2;
  level3Line: string;
  passed: number;
  total: number;
  checks: CheckItem[];
  numbers: { udyamNo: string | null; gstin: string | null; consumerNo: string | null };
  doc: {
    udyamNo: string;
    enterpriseName: string;
    state: string;
    majorActivity: string;
    isSample: boolean;
  } | null;
  isSample: boolean;
}

export interface WizardState {
  step?: number;
  documentId?: string | null;
  dieselLitres?: number | null;
  productionTonnes?: number | null;
  sample?: Record<string, boolean>;
}

export interface OnboardingView {
  done: boolean;
  state: WizardState;
  business: BusinessView;
  samples: {
    isDemo: boolean;
    dieselLitres: number | null;
    dieselMonth: string | null;
    productionTonnes: number | null;
    productionMonth: string | null;
  };
}

export interface StripMonth {
  month: string;
  label: string;
  present: boolean;
}

export interface DocChecks {
  status: string;
  fields:
    | (Record<string, unknown> & { periodStart: string; kwh: number; kvah: number; total: number })
    | null;
  sourceKind: string | null;
  sourceText: string | null;
  sample: 'clean' | 'edited' | null;
  checks: CheckItem[];
  strength: Strength;
  strip: StripMonth[];
  methodNote: string;
}

export type Strength = 'pdf_passed' | 'photo_confirmed' | 'typed' | 'second_look';

export interface MonthValues {
  kwh: number | null;
  kvah: number | null;
  mdKva: number | null;
  energyCharges: number | null;
  demandCharges: number | null;
}

export interface MonthCard {
  id: string;
  month: string;
  values: MonthValues;
  sourceKind: string | null;
  sourceText: string;
  fileSha256: string | null;
  checks: CheckItem[];
  strength: Strength;
  strengthText: string;
  lockedAt: string | null;
  lockReason: string | null;
  version: number;
  tonnes: number | null;
}

export interface DataMonths {
  months: MonthCard[];
  strip: StripMonth[];
  gaps: string[];
  methodNote: string;
}

export interface MonthHistory {
  month: string;
  lockedAt: string | null;
  current: MonthValues;
  versions: Array<{ version: number; values: MonthValues; reason: string; createdAt: string }>;
  note: string;
}

export const STRENGTH_TONE: Record<Strength, 'positive' | 'check' | 'neutral'> = {
  pdf_passed: 'positive',
  photo_confirmed: 'positive',
  typed: 'neutral',
  second_look: 'check',
};

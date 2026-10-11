import { assertNonNegative, InvalidInputError } from './errors';
import type { QualityTag } from './types';

export interface QualityItem {
  /** Emissions resting on this input, t CO2 or t CO2e. */
  tonnes: number;
  tag: QualityTag;
}

export interface DataQualityResult {
  measuredSharePct: number;
  /** Reports below 70% measured carry a warning banner (Doc 03). */
  belowThreshold: boolean;
  byTag: Record<QualityTag, { tonnes: number; sharePct: number }>;
}

const MEASURED_THRESHOLD_PCT = 70;
const TAGS: QualityTag[] = ['measured', 'owner_entered', 'estimated', 'default'];

/** Doc 03: data quality score = share of total emissions resting on measured inputs. */
export function dataQualityScore(items: QualityItem[]): DataQualityResult {
  const totals = Object.fromEntries(TAGS.map((t) => [t, 0])) as Record<QualityTag, number>;
  for (const [i, item] of items.entries()) {
    assertNonNegative(`item ${i} tonnes`, item.tonnes);
    totals[item.tag] += item.tonnes;
  }
  const total = TAGS.reduce((t, tag) => t + totals[tag], 0);
  if (total === 0) throw new InvalidInputError('total emissions must be > 0');

  const byTag = Object.fromEntries(
    TAGS.map((t) => [t, { tonnes: totals[t], sharePct: (100 * totals[t]) / total }]),
  ) as DataQualityResult['byTag'];
  const measuredSharePct = byTag.measured.sharePct;
  return { measuredSharePct, belowThreshold: measuredSharePct < MEASURED_THRESHOLD_PCT, byTag };
}

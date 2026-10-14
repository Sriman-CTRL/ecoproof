/**
 * D8/D89 business check: offline format checks on numbers the owner types (findings-business-check
 * section 4 and 6). They catch typos and mismatches, not a forged number.
 */

/** The demo foundry's Udyam number (SYNTHETIC). */
export const SAMPLE_UDYAM_NO = 'UDYAM-SAMPLE-0001';

/**
 * Udyam number pattern UDYAM-XX-00-0000000 (state letters, district digits, serial). INFERRED from
 * published Udyam certificate examples, not from a published specification.
 */
export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export type UdyamFormat = 'ok' | 'sample' | 'bad';

export function udyamFormat(raw: string): UdyamFormat {
  const v = raw.trim().toUpperCase();
  if (v === SAMPLE_UDYAM_NO) return 'sample';
  return UDYAM_PATTERN.test(v) ? 'ok' : 'bad';
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Standard GSTIN check digit (mod 36 over the first 14 characters, weights 1 and 2). */
export function gstinCheckDigit(first14: string): string | null {
  if (first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(first14[i]!);
    if (v < 0) return null;
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36]!;
}

/** Telangana GST state code (findings-business-check section 4). */
export const TELANGANA_STATE_CODE = '36';

export interface GstinCheck {
  ok: boolean;
  /** First problem found, in plain words; null when ok. */
  problem: string | null;
  stateCode: string | null;
  /** The PAN inside the GSTIN, for an in-memory match only: never stored. */
  panInside: string | null;
}

/** 2-digit state, 10-character PAN, entity number, "Z", check digit. */
export function checkGstin(raw: string, expectState = TELANGANA_STATE_CODE): GstinCheck {
  const v = raw.trim().toUpperCase();
  const bad = (problem: string): GstinCheck => ({
    ok: false,
    problem,
    stateCode: v.slice(0, 2) || null,
    panInside: null,
  });
  if (v.length !== 15) return bad('A GSTIN has 15 characters.');
  if (!/^\d{2}$/.test(v.slice(0, 2))) return bad('The first two characters are the state code.');
  if (v.slice(0, 2) !== expectState) {
    return bad(`State code ${v.slice(0, 2)} is not Telangana (${expectState}).`);
  }
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(v.slice(2, 12))) {
    return bad('Characters 3 to 12 should be a PAN (5 letters, 4 digits, 1 letter).');
  }
  if (!/^[1-9A-Z]$/.test(v[12]!)) return bad('Character 13 is the entity number (1-9 or A-Z).');
  if (v[13] !== 'Z') return bad('Character 14 is always "Z".');
  if (gstinCheckDigit(v.slice(0, 14)) !== v[14]) {
    return bad('The last character (check digit) does not match: a character may be mistyped.');
  }
  return { ok: true, problem: null, stateCode: v.slice(0, 2), panInside: v.slice(2, 12) };
}

/** A SYNTHETIC GSTIN for the demo: Telangana code, the well-known dummy PAN, a valid check digit. */
export const SAMPLE_GSTIN_BODY = `${TELANGANA_STATE_CODE}AAAAA0000A1Z`;
export const SAMPLE_GSTIN = `${SAMPLE_GSTIN_BODY}${gstinCheckDigit(SAMPLE_GSTIN_BODY)}`;

import { GoogleGenAI, Type } from '@google/genai';
import { POWER_BILL_FIELD_NAMES, PowerBillFields } from '@ecoproof/shared';
import { z } from 'zod';
import type { DocumentReader, PowerBillReading } from './types.js';

export const GEMINI_MODEL = 'gemini-2.5-flash';

const str = { type: Type.STRING };
const num = { type: Type.NUMBER };
const fieldProps = {
  consumerNo: str,
  billNo: str,
  periodStart: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
  periodEnd: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
  kwh: num,
  kvah: num,
  pf: num,
  mdKva: num,
  contractedDemandKva: num,
  peakKwh: num,
  energyCharges: num,
  demandCharges: num,
  // Gemini cannot express a free-form map, so other charges come back as name/amount pairs.
  otherCharges: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: { name: str, amount: num },
      required: ['name', 'amount'],
    },
  },
  total: num,
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    fields: { type: Type.OBJECT, properties: fieldProps, required: Object.keys(fieldProps) },
    confidence: {
      type: Type.OBJECT,
      properties: Object.fromEntries(POWER_BILL_FIELD_NAMES.map((k) => [k, num])),
      required: [...POWER_BILL_FIELD_NAMES],
    },
  },
  required: ['fields', 'confidence'],
};

const INSTRUCTION =
  'Read this electricity bill. Return ONLY JSON matching the schema. ' +
  'fields: values as printed on the bill. Dates as YYYY-MM-DD. Numbers as plain numbers (no commas, no currency). ' +
  'kwh = active energy, kvah = apparent energy, pf = power factor 0-1, mdKva = maximum demand recorded, ' +
  'peakKwh = kWh in the peak time-of-day band, otherCharges = every other charge line as name/amount. ' +
  'confidence: for every field a number 0-1 for how sure you are of the reading (1 = clearly legible).';

const RawReading = z.object({
  fields: z.looseObject({
    otherCharges: z
      .array(z.object({ name: z.string(), amount: z.number() }))
      .transform((a) => Object.fromEntries(a.map((c) => [c.name, c.amount]))),
  }),
  confidence: z.record(z.string(), z.number().min(0).max(1)),
});

export class ReaderOutputError extends Error {}

export class GeminiReader implements DocumentReader {
  private readonly ai: GoogleGenAI;
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** One attempt; the extract job owns the retry loop. Only the document and schema are sent. */
  async readPowerBill(bytes: Buffer, mime: string): Promise<PowerBillReading> {
    const res = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mime, data: bytes.toString('base64') } },
            { text: INSTRUCTION },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema, temperature: 0 },
    });
    let json: unknown;
    try {
      json = JSON.parse(res.text ?? '');
    } catch {
      throw new ReaderOutputError('Reader returned non-JSON output');
    }
    const raw = RawReading.safeParse(json);
    if (!raw.success) throw new ReaderOutputError('Reader output did not match the schema');
    const fields = PowerBillFields.safeParse(raw.data.fields);
    if (!fields.success) throw new ReaderOutputError('Reader fields failed validation');
    return { fields: fields.data, confidence: raw.data.confidence, model: GEMINI_MODEL };
  }
}

import { z } from 'zod';

/** Accepts 1234, "1,234.5" or Indian grouping "9,10,000"; returns a number. */
export const NumberLike = z.preprocess((v) => {
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '').replace(/^₹|^Rs\.?/i, '');
    return cleaned === '' ? v : Number(cleaned);
  }
  return v;
}, z.number().finite());

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD');

export const PowerBillFields = z.object({
  consumerNo: z.string().min(1),
  billNo: z.string().min(1),
  periodStart: IsoDate,
  periodEnd: IsoDate,
  kwh: NumberLike,
  kvah: NumberLike,
  pf: NumberLike,
  mdKva: NumberLike,
  contractedDemandKva: NumberLike,
  peakKwh: NumberLike,
  energyCharges: NumberLike,
  demandCharges: NumberLike,
  otherCharges: z.record(z.string(), NumberLike),
  total: NumberLike,
});
export type PowerBillFields = z.infer<typeof PowerBillFields>;

export const POWER_BILL_FIELD_NAMES = Object.keys(PowerBillFields.shape) as Array<
  keyof PowerBillFields
>;

/** Per-field confidence 0-1, keyed by PowerBillFields names. */
export const FieldConfidence = z.record(z.string(), z.number().min(0).max(1));
export type FieldConfidence = z.infer<typeof FieldConfidence>;

export const DemoLoginBody = z.object({ demo: z.enum(['A', 'B', 'H']) });
export const ConsentBody = z.object({
  noticeVersion: z.string().min(1),
  purpose: z.string().min(1),
});
export const ManualBody = z.object({ fields: PowerBillFields });
export const ConfirmBody = z.object({
  fields: PowerBillFields,
  productionTonnes: NumberLike.pipe(z.number().nonnegative()),
  dieselLitres: NumberLike.pipe(z.number().nonnegative()).optional(),
  acknowledged: z.array(z.string()).optional(),
});
export type ConfirmBody = z.infer<typeof ConfirmBody>;

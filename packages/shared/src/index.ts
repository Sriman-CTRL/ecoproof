import { z } from 'zod';
export * from './powerBill';
export * from './wording';
export * from './carbonText';

export const QualityTag = z.enum(['measured', 'owner_entered', 'estimated', 'default']);
export type QualityTag = z.infer<typeof QualityTag>;

export const FactorStatus = z.enum([
  'confirmed',
  'confirmed_replace',
  'verify',
  'estimate_only',
  'rule',
]);
export type FactorStatus = z.infer<typeof FactorStatus>;

declare const unit: unique symbol;
/** A number tagged with its unit so rupees, kWh etc. are not mixed up. */
export type Unit<U extends string> = number & { readonly [unit]: U };

export type Rupees = Unit<'inr'>;
export type Kwh = Unit<'kwh'>;
export type Kvah = Unit<'kvah'>;
export type KvaMd = Unit<'kva'>;
export type TonnesCo2 = Unit<'t_co2'>;
export type KgCo2e = Unit<'kg_co2e'>;

export type Money = { inr: Rupees };

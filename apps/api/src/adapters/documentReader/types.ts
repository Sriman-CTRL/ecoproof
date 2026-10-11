import type { PowerBillFields } from '@ecoproof/shared';

export interface PowerBillReading {
  fields: PowerBillFields;
  confidence: Record<string, number>;
  model: string;
}

export interface DocumentReader {
  readPowerBill(bytes: Buffer, mime: string): Promise<PowerBillReading>;
}

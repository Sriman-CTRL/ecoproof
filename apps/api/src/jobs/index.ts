import { calculateJob } from './calculate.js';
import { extractJob } from './extract.js';

export interface JobMap {
  extract: { payload: { documentId: string }; result: void };
  calculate: { payload: { siteId: string; month: string }; result: { resultId: string } };
}
export type JobName = keyof JobMap;

const handlers: { [K in JobName]: (p: JobMap[K]['payload']) => Promise<JobMap[K]['result']> } = {
  extract: extractJob,
  calculate: calculateJob,
};

/** Prototype: runs inline. A BullMQ producer can replace this body without touching callers. */
export async function runJob<K extends JobName>(
  name: K,
  payload: JobMap[K]['payload'],
): Promise<JobMap[K]['result']> {
  return handlers[name](payload);
}

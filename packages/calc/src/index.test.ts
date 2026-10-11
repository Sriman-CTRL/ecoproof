import { describe, expect, it } from 'vitest';
import * as calc from './index';

describe('@ecoproof/calc', () => {
  it('exports nothing yet', () => {
    expect(Object.keys(calc)).toHaveLength(0);
  });
});

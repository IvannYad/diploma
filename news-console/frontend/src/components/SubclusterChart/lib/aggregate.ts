import type { AggMethod } from './types';

export function aggregateRecords(
  records: Array<{ [key: string]: string | number | null }>,
  factName: string,
  method: AggMethod,
): number | null {
  const values = records
    .map((r) => {
      const v = r[factName];
      return typeof v === 'number' ? v : v !== null && v !== undefined ? parseFloat(String(v)) : NaN;
    })
    .filter((v) => !isNaN(v));

  if (values.length === 0) return null;

  switch (method) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'first':
      return values[0];
    case 'last':
      return values[values.length - 1];
    case 'count':
      return values.length;
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

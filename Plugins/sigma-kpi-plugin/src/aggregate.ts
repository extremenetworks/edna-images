export type AggKey = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last';

const AGG_MAP: Record<string, AggKey> = {
  sum: 'sum',
  average: 'avg',
  min: 'min',
  max: 'max',
  count: 'count',
  'first row': 'first',
  'last row': 'last',
};

export function toAggKey(label: string | undefined): AggKey {
  return AGG_MAP[(label || 'sum').toLowerCase()] || 'sum';
}

/** Coerce numbers / numeric strings (e.g. "$1,234") to numbers, dropping anything unparseable. */
export function toNumbers(values: unknown[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
      if (!isNaN(n)) out.push(n);
    }
  }
  return out;
}

export function aggregate(values: unknown[] | null | undefined, agg: AggKey): number {
  if (!values || values.length === 0) return 0;
  const nums = toNumbers(values);
  if (nums.length === 0) return 0;
  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    case 'count':
      return values.length;
    case 'first':
      return nums[0] ?? 0;
    case 'last':
      return nums[nums.length - 1] ?? 0;
    default:
      return nums[0] ?? 0;
  }
}

const SI_PREFIXES = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value === 0) return '$0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { value: threshold, suffix } of SI_PREFIXES) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      const formatted = scaled >= 100
        ? `$${sign}${Math.round(scaled)}${suffix}`
        : scaled >= 10
          ? `$${sign}${scaled.toFixed(1).replace(/\.0$/, '')}${suffix}`
          : `$${sign}${scaled.toFixed(2).replace(/\.?0+$/, '')}${suffix}`;
      return formatted;
    }
  }

  return `$${sign}${Math.round(abs).toLocaleString()}`;
}

export function formatWoW(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value === 0) return '$0';

  const sign = value > 0 ? '+' : '';
  const abs = Math.abs(value);

  for (const { value: threshold, suffix } of SI_PREFIXES) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      const fmtNum = scaled >= 10
        ? Math.round(scaled).toString()
        : scaled.toFixed(1).replace(/\.0$/, '');
      return `${sign}$${value < 0 ? '-' : ''}${fmtNum}${suffix}`;
    }
  }

  return `${sign}$${Math.round(value).toLocaleString()}`;
}

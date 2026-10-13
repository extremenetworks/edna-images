// Lightweight d3-style format strings, e.g. "$,.1~S" → prefix "$", commas, 1 decimal, auto-scale (K/M/B/T).

const SCALES = [
  { threshold: 1e12, divisor: 1e12, suffix: 'T' },
  { threshold: 1e9, divisor: 1e9, suffix: 'B' },
  { threshold: 1e6, divisor: 1e6, suffix: 'M' },
  { threshold: 1e3, divisor: 1e3, suffix: 'K' },
];

interface ParsedFormat {
  prefix: string;
  suffix: string;
  decimals: number;
  commas: boolean;
  autoScale: boolean;
}

function parseFormat(fmt: string): ParsedFormat {
  const out: ParsedFormat = { prefix: '', suffix: '', decimals: 0, commas: false, autoScale: false };
  if (!fmt) return out;
  let rest = fmt;
  const idx = rest.search(/[,\.~%]/);
  if (idx > 0) {
    out.prefix = rest.slice(0, idx);
    rest = rest.slice(idx);
  } else if (idx === -1) {
    out.prefix = rest;
    return out;
  }
  if (rest.startsWith(',')) {
    out.commas = true;
    rest = rest.slice(1);
  }
  const dec = rest.match(/^\.(\d)/);
  if (dec) {
    out.decimals = parseInt(dec[1], 10);
    rest = rest.slice(dec[0].length);
  }
  if (rest.startsWith('~S') || rest.startsWith('~s')) {
    out.autoScale = true;
    rest = rest.slice(2);
  }
  out.suffix = rest;
  return out;
}

export function formatNumber(value: number, fmt: string): string {
  const f = parseFormat(fmt);
  let n = value;
  let scaleSuffix = '';
  if (f.suffix === '%') n = n * 100;
  if (f.autoScale) {
    const abs = Math.abs(n);
    for (const { threshold, divisor, suffix } of SCALES) {
      if (abs >= threshold) {
        n = n / divisor;
        scaleSuffix = suffix;
        break;
      }
    }
  }
  const [intPart, decPart] = n.toFixed(f.decimals).split('.');
  const intStr = f.commas ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : intPart;
  const num = decPart !== undefined ? `${intStr}.${decPart}` : intStr;
  return `${f.prefix}${num}${scaleSuffix}${f.suffix}`;
}

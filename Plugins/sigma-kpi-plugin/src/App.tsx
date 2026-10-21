import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useActionTrigger,
  useConfig,
  useElementColumns,
  useElementData,
  useVariable,
} from '@sigmacomputing/plugin';
import { KpiGrid } from './components/KpiGrid';
import { aggregate, toAggKey, toNumbers, type AggKey } from './aggregate';
import { formatNumber } from './format';
import { COMP_COUNT, MAX_KPIS } from './editorPanel';
import type { Comparison, Kpi, Layout, Theme } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Config = Record<string, any>;
type ColumnData = Record<string, any[]>;
type ColumnInfo = Record<string, { name: string; columnType: string }>;

interface Bound {
  srcId: string;
  colId: string;
  data: ColumnData;
  columns: ColumnInfo;
}

/** Subscribes to an element + column pair from config. */
function useBound(config: Config, srcKey: string, colKey: string): Bound {
  const srcId = config[srcKey] || '';
  const colId = config[colKey] || '';
  const data = useElementData(srcId) as ColumnData;
  const columns = useElementColumns(srcId) as ColumnInfo;
  return { srcId, colId, data, columns };
}

const SEGMENT_PALETTE = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const BORDER_WIDTHS: Record<string, string> = { none: '0', thin: '1px', medium: '2px', thick: '3px' };

/** Parses a px dropdown value; "Auto"/blank/invalid → fallback. */
function parsePx(v: unknown, fallback: number | null): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return isNaN(n) || n < 0 ? fallback : n;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function normalizeHex(s: string): string | null {
  const t = s.trim();
  if (!HEX_RE.test(t)) return null;
  return t.startsWith('#') ? t : `#${t}`;
}

/**
 * Parses "Segment Pill Colors". Accepts `Label:#hex` pairs (matched case-insensitively) and/or
 * bare hex codes, which are applied by position to segments without an explicit mapping.
 * Separators: commas, semicolons, or new lines. Invalid entries are ignored.
 */
function parsePillColors(input: string): { byLabel: Map<string, string>; ordered: string[] } {
  const byLabel = new Map<string, string>();
  const ordered: string[] = [];
  for (const part of (input || '').split(/[,;\n]/)) {
    if (!part.trim()) continue;
    const sep = part.lastIndexOf(':');
    if (sep > 0) {
      const hex = normalizeHex(part.slice(sep + 1));
      if (hex) byLabel.set(part.slice(0, sep).trim().toLowerCase(), hex);
    } else {
      const hex = normalizeHex(part);
      if (hex) ordered.push(hex);
    }
  }
  return { byLabel, ordered };
}

function isNumericColumn(columns: ColumnInfo, colId: string): boolean {
  const c = columns[colId];
  return !!c && (c.columnType === 'number' || c.columnType === 'integer');
}

/**
 * Builds comparison text. `{value}` is replaced with the (aggregated + formatted) value,
 * `{label}` with the column name, `{pct}` with KPI value ÷ comparison value (e.g. attainment
 * vs. projected total). With no `{value}` token the value is prepended.
 */
function applyTemplate(template: string, colName: string, valueStr: string, pctStr = ''): string {
  const t = (template || colName).replace(/\{label\}/g, colName).replace(/\{pct\}/g, pctStr);
  return t.includes('{value}') ? t.replace(/\{value\}/g, valueStr) : `${valueStr} ${t}`.trim();
}

function pctOf(main: number, comp: number): string {
  if (!comp || !isFinite(main / comp)) return '—';
  return formatNumber(main / comp, '.0%');
}

/** Comparison text for Manual mode, where each comparison has its own source element. */
function manualComparisonText(
  colId: string,
  template: string,
  fmt: string,
  agg: AggKey,
  data: ColumnData,
  columns: ColumnInfo,
  mainValue: number,
): string {
  if (!template && !colId) return '';
  const colName = colId && columns[colId] ? columns[colId].name : '';
  const text = template || colName;
  if (!colId || !data[colId]) {
    return text.replace(/\{value\}/g, '').replace(/\{pct\}/g, '').replace(/\{label\}/g, colName).trim();
  }
  const values = data[colId];
  const first = values?.[0];
  const col = columns[colId];
  const numeric = col ? col.columnType === 'number' || col.columnType === 'integer' : typeof first === 'number';
  if (!numeric) return applyTemplate(text, colName, first != null ? String(first) : '');
  const n = aggregate(values, agg);
  return applyTemplate(text, colName, formatNumber(n, fmt), pctOf(mainValue, n));
}

export default function App() {
  const config = useConfig() as Config;
  const mode = (config.mode || 'Manual').toLowerCase();

  // Force re-render when the iframe is resized or becomes visible again.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const ro = new ResizeObserver(bump);
    ro.observe(document.documentElement);
    document.addEventListener('visibilitychange', bump);
    window.addEventListener('resize', bump);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', bump);
      window.removeEventListener('resize', bump);
    };
  }, []);

  // Hook calls must be unconditional and stable in count.
  const seg = useBound(config, 'seg_source', 'seg_val');
  const segLabelCol: string = config.seg_col || '';
  // Kept for hook-count stability; no longer used for auto-segment Control 2.
  const click2 = useBound(config, 'click2Src', 'click2Col');
  const kpiSources: Bound[] = [];
  const compSources: Bound[][] = [];
  for (let i = 0; i < MAX_KPIS; i++) kpiSources.push(useBound(config, `source_${i}`, `col_${i}`));
  for (let c = 1; c <= COMP_COUNT; c++) {
    const row: Bound[] = [];
    for (let i = 0; i < MAX_KPIS; i++) row.push(useBound(config, `c${c}src_${i}`, `c${c}col_${i}`));
    compSources.push(row);
  }

  const theme: Theme = {
    bgColor: config.bgColor || '#1a1f36',
    valueColor: config.valueColor || '#ffffff',
    labelColor: config.labelColor || '#9b9fb5',
    compColor: config.compColor || '#9b9fb5',
    valueFontSize: config.valueFontSize || '36',
    compFontSize: config.compFontSize || '13',
    labelFontSize: config.labelFontSize || '14',
    borderWidth: BORDER_WIDTHS[(config.borderStyle || 'None').toLowerCase()] || '0',
    borderColor: config.borderColor || '#ffffff',
    borderRadius: config.borderRadius || '8',
  };

  const layout: Layout = {
    minCardWidth: parseInt(config.minCardWidth || '200', 10) || 200,
    cardGap: parseInt(config.cardGap || '16', 10),
    cardPadding: parsePx(config.cardPadding, null),
    containerPadding: parsePx(config.containerPadding, 4) ?? 4,
    contentGap: parsePx(config.contentGap, 8) ?? 8,
    cardLayout: (config.cardLayout || 'Stack').toLowerCase() === 'grid' ? 'grid' : 'stack',
    animEnabled: config.animEnabled !== false,
    showInfoIcon: config.showInfoIcon !== false,
    animDuration: 1500,
    animStagger: 100,
  };

  const displayOrderStr: string = config.displayOrder || '';
  const displayOrder = displayOrderStr
    ? displayOrderStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => n >= 0 && n < MAX_KPIS)
    : Array.from({ length: MAX_KPIS }, (_, i) => i);

  const dataDeps = [
    seg.data,
    click2.data,
    ...kpiSources.map((b) => b.data),
    ...compSources.flat().map((b) => b.data),
  ];

  const kpis = useMemo<Kpi[]>(() => {
    // ── Auto Segment: one card per distinct value of the segment column ──
    if (mode === 'auto segment' && seg.srcId && segLabelCol && seg.colId) {
      const labels = seg.data[segLabelCol];
      const values = seg.data[seg.colId];
      if (!labels || !values) return [];

      const valueAgg = toAggKey(config.seg_agg || 'Sum');
      const valueFmt = config.seg_fmt || ',.0';

      const comps = Array.from({ length: COMP_COUNT }, (_, k) => {
        const c = k + 1;
        const colId: string = config[`seg_c${c}col`] || '';
        const pill = (config[`seg_c${c}style`] || 'Text').toLowerCase() === 'pill';
        return {
          colId,
          values: colId ? seg.data[colId] : null,
          template: (config[`seg_c${c}text`] || '') as string,
          fmt: (config[`seg_c${c}fmt`] || ',.2') as string,
          agg: toAggKey(config[`seg_c${c}agg`] || 'Sum'),
          pill,
          pillBg: (config[`seg_c${c}pillBg`] || '#2a2f4a') as string,
          pillColor: (config[`seg_c${c}pillColor`] || '#ffffff') as string,
          colName: colId && seg.columns[colId] ? seg.columns[colId].name : '',
          numeric: colId ? isNumericColumn(seg.columns, colId) : false,
        };
      });

      const click2ColId: string = config.seg_click2Col || '';
      const click2Values = click2ColId ? seg.data[click2ColId] : null;
      const sortColId: string = config.seg_sortCol || '';
      const sortValues = sortColId ? seg.data[sortColId] : null;
      const descColId: string = config.seg_descCol || '';
      const descValues = descColId ? seg.data[descColId] : null;

      // Group rows by segment label, preserving first-seen order.
      const groups = new Map<string, { vals: number[]; comp: unknown[][]; sort: unknown[]; desc?: string; click2?: string }>();
      for (let r = 0; r < labels.length; r++) {
        const key = labels[r] != null ? String(labels[r]) : '';
        if (!groups.has(key)) groups.set(key, { vals: [], comp: comps.map(() => []), sort: [] });
        const g = groups.get(key)!;
        if (sortValues) g.sort.push(sortValues[r]);
        if (click2Values && g.click2 === undefined && click2Values[r] != null && click2Values[r] !== '') {
          g.click2 = String(click2Values[r]);
        }
        if (descValues && g.desc === undefined && descValues[r] != null && descValues[r] !== '') {
          g.desc = String(descValues[r]);
        }
        const v = values[r];
        if (typeof v === 'number') g.vals.push(v);
        else if (typeof v === 'string') {
          const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
          if (!isNaN(n)) g.vals.push(n);
        }
        comps.forEach((cp, k) => {
          if (cp.values) g.comp[k].push(cp.values[r]);
        });
      }

      const pillColors = parsePillColors(config.seg_pillColors || '');
      const result: Kpi[] = [];
      const sortKeys = new Map<string, number | string>();
      let segIdx = 0;
      for (const [label, g] of groups) {
        // Per-segment override by label, else the built-in palette. Positional overrides are
        // applied after sorting so they follow display order.
        const paletteColor =
          pillColors.byLabel.get(label.toLowerCase()) ??
          SEGMENT_PALETTE[segIdx % SEGMENT_PALETTE.length];
        const mainValue = aggregate(g.vals, valueAgg);
        const comparisons: Comparison[] = [];
        comps.forEach((cp, k) => {
          if (!cp.colId || !(cp.template || cp.values)) return;
          const raw = g.comp[k];
          let valueStr: string;
          let pctStr = '';
          if (cp.numeric) {
            const n = aggregate(raw, cp.agg);
            valueStr = formatNumber(n, cp.fmt);
            pctStr = pctOf(mainValue, n);
          } else {
            valueStr = raw[0] != null ? String(raw[0]) : '';
          }
          comparisons.push({
            text: applyTemplate(cp.template, cp.colName, valueStr, pctStr),
            color: theme.compColor,
            pill: cp.pill,
            // Pills in segment mode are colored from the palette per segment.
            pillBg: cp.pill ? paletteColor : cp.pillBg,
            pillColor: cp.pillColor,
          });
        });

        const clickValues: Record<number, string> = { 1: label };
        if (g.click2) clickValues[2] = g.click2;
        const descTemplate: string = config.seg_desc || '';

        // Sort key: smallest numeric value in the sort column for this segment, else first text value.
        if (sortValues) {
          const nums = toNumbers(g.sort.filter((v) => typeof v === 'number'));
          sortKeys.set(label, nums.length ? Math.min(...nums) : g.sort[0] != null ? String(g.sort[0]) : '');
        }

        result.push({
          id: `seg-${label}`,
          label,
          value: mainValue,
          formatStr: valueFmt,
          comparisons,
          stacked: false,
          segmentValue: label,
          clickValues,
          description: g.desc ?? (descTemplate ? descTemplate.replace(/\{label\}/g, label) : undefined),
        });
        segIdx++;
      }

      const sort = (config.seg_sort || 'None').toLowerCase();
      if (sort.startsWith('label a')) result.sort((a, b) => a.label.localeCompare(b.label));
      else if (sort.startsWith('label z')) result.sort((a, b) => b.label.localeCompare(a.label));
      else if (sort.startsWith('value h')) result.sort((a, b) => b.value - a.value);
      else if (sort.startsWith('value l')) result.sort((a, b) => a.value - b.value);
      else if (sort.startsWith('sort column') && sortValues) {
        const dir = sort.includes('↓') ? -1 : 1;
        result.sort((a, b) => {
          const ka = sortKeys.get(a.label) ?? '';
          const kb = sortKeys.get(b.label) ?? '';
          const cmp =
            typeof ka === 'number' && typeof kb === 'number'
              ? ka - kb
              : String(ka).localeCompare(String(kb), undefined, { numeric: true });
          return cmp * dir;
        });
      }
      else if (sort === 'custom') {
        const order = (config.seg_sortOrder || '').split(',').map((s: string) => s.trim().toLowerCase());
        result.sort((a, b) => {
          const ia = order.indexOf(a.label.toLowerCase());
          const ib = order.indexOf(b.label.toLowerCase());
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return 0;
        });
      }

      // Bare hex codes color the remaining (unmapped) segments in display order.
      if (pillColors.ordered.length) {
        let pos = 0;
        for (const kpi of result) {
          if (pillColors.byLabel.has(kpi.label.toLowerCase())) continue;
          const hex = pillColors.ordered[pos++];
          if (!hex) break;
          for (const c of kpi.comparisons) if (c.pill) c.pillBg = hex;
        }
      }
      return result;
    }

    // ── Manual: up to MAX_KPIS individually configured cards ──
    const result: Kpi[] = [];
    for (const i of displayOrder) {
      const src = kpiSources[i];
      if (!src.srcId || !src.colId) continue;
      const mainValue = aggregate(src.data[src.colId], toAggKey(config[`agg_${i}`] || 'Sum'));

      const comparisons: Comparison[] = [];
      for (let c = 1; c <= COMP_COUNT; c++) {
        const cs = compSources[c - 1][i];
        const template: string = config[`c${c}text_${i}`] || '';
        if (!template && !cs.colId) continue;
        comparisons.push({
          text: manualComparisonText(
            cs.colId,
            template,
            config[`c${c}fmt_${i}`] || ',.2',
            toAggKey(config[`c${c}agg_${i}`] || 'Sum'),
            cs.data,
            cs.columns,
            mainValue,
          ),
          color: theme.compColor,
          pill: (config[`c${c}style_${i}`] || 'Text').toLowerCase() === 'pill',
          pillBg: config[`c${c}pillBg_${i}`] || '#2a2f4a',
          pillColor: config[`c${c}pillColor_${i}`] || '#ffffff',
        });
      }

      result.push({
        id: `kpi-${i}`,
        label: config[`label_${i}`] || '',
        value: mainValue,
        formatStr: config[`fmt_${i}`] || ',.0',
        comparisons,
        stacked: !!config[`stack_${i}`],
        description: config[`desc_${i}`] || undefined,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, mode, ...dataDeps]);

  const [, setClickVar1] = useVariable(config.clickVar1 || '');
  const [, setClickVar2] = useVariable(config.clickVar2 || '');
  const triggerCardAction = useActionTrigger(config.segAction || '');

  const handleCardClick = useCallback(
    async (kpi: Kpi) => {
      if (!kpi.segmentValue) return;
      const vals = kpi.clickValues || {};
      if (vals[1]) await setClickVar1(vals[1]);
      if (vals[2]) await setClickVar2(vals[2]);
      if (triggerCardAction) await triggerCardAction();
    },
    [setClickVar1, setClickVar2, triggerCardAction],
  );

  if (kpis.length === 0) {
    // Config not received yet, or a source is set but data hasn't arrived → still loading.
    const configLoaded = Object.keys(config).length > 0;
    const hasSource =
      (mode === 'auto segment' && !!seg.srcId) || kpiSources.some((b) => b.srcId && b.colId);
    if (!configLoaded || hasSource) {
      return (
        <div className="plugin-message">
          <div className="kpi-spinner" role="status" aria-label="Loading" />
        </div>
      );
    }
    return (
      <div className="plugin-message">
        <p>Configure a KPI in the element panel: select a Source and Value Column.</p>
      </div>
    );
  }

  return (
    <div className="plugin-root">
      <KpiGrid kpis={kpis} theme={theme} layout={layout} onCardClick={handleCardClick} />
    </div>
  );
}

import { client } from '@sigmacomputing/plugin';

export const MAX_KPIS = 5;
/** Comps 1–3 are general comparisons; the last slot is the Projected Total comparison. */
export const COMP_COUNT = 4;
export const PROJECTED_COMP = 4;

function compName(c: number): string {
  return c === PROJECTED_COMP ? 'Projected Total' : `Comp ${c}`;
}
function compPlaceholder(c: number): string {
  return c === PROJECTED_COMP ? 'Projected {value} ({pct} attained)' : COMP_PLACEHOLDER;
}

const AGG_VALUES = ['Sum', 'Average', 'Min', 'Max', 'Count', 'First Row', 'Last Row'];
const FMT_PLACEHOLDER = '$,.1~S';
const COMP_PLACEHOLDER = '{value}% of {label}';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E: any[] = [];

// ── Mode / Auto Segment ──
E.push({ name: 'mode', type: 'dropdown', label: 'Mode', values: ['Manual', 'Auto Segment'], defaultValue: 'Manual' });
E.push({ name: 'seg_source', type: 'element', label: 'Segment Source' });
E.push({ name: 'seg_col', type: 'column', source: 'seg_source', allowMultiple: false, label: 'Segment By (labels)' });
E.push({ name: 'seg_val', type: 'column', source: 'seg_source', allowMultiple: false, label: 'Value Column' });
E.push({ name: 'seg_agg', type: 'dropdown', source: 'seg_source', label: 'Aggregate', values: AGG_VALUES, defaultValue: 'Sum' });
E.push({ name: 'seg_fmt', type: 'text', source: 'seg_source', label: 'Format', placeholder: FMT_PLACEHOLDER, defaultValue: ',.0' });
E.push({
  name: 'seg_sort', type: 'dropdown', source: 'seg_source', label: 'Sort By',
  values: ['None', 'Label A→Z', 'Label Z→A', 'Value High→Low', 'Value Low→High', 'Sort Column ↑', 'Sort Column ↓', 'Custom'],
  defaultValue: 'None',
});
E.push({ name: 'seg_sortCol', type: 'column', source: 'seg_source', allowMultiple: false, label: 'Sort Column' });
E.push({ name: 'seg_sortOrder', type: 'text', source: 'seg_source', label: 'Custom Order', placeholder: 'Closed,Commit,Pipeline', defaultValue: '' });
E.push({ name: 'seg_desc', type: 'text', source: 'seg_source', label: 'Description / Tooltip', placeholder: '{label} details', defaultValue: '', multiline: true });
E.push({ name: 'seg_descCol', type: 'column', source: 'seg_source', allowMultiple: false, label: 'Description Column (overrides text)' });
E.push({
  name: 'seg_pillColors', type: 'text', source: 'seg_source', label: 'Segment Pill Colors (optional)',
  placeholder: 'Closed:#22c55e, Commit:#3b82f6  — or —  #22c55e, #3b82f6', defaultValue: '', multiline: true,
});
for (let c = 1; c <= COMP_COUNT; c++) {
  const n = compName(c);
  E.push({ name: `seg_c${c}col`, type: 'column', source: 'seg_source', allowMultiple: false, label: `${n} Column` });
  E.push({ name: `seg_c${c}text`, type: 'text', source: 'seg_source', label: `${n} Label`, placeholder: compPlaceholder(c), defaultValue: '' });
  E.push({ name: `seg_c${c}fmt`, type: 'text', source: 'seg_source', label: `${n} Format`, placeholder: FMT_PLACEHOLDER, defaultValue: ',.2' });
  E.push({ name: `seg_c${c}agg`, type: 'dropdown', source: 'seg_source', label: `${n} Aggregate`, values: AGG_VALUES, defaultValue: 'Sum' });
  E.push({ name: `seg_c${c}style`, type: 'dropdown', source: 'seg_source', label: `${n} Style`, values: ['Text', 'Pill'], defaultValue: 'Text' });
  E.push({ name: `seg_c${c}pillBg`, type: 'color', source: 'seg_source', label: `${n} Pill Bg` });
  E.push({ name: `seg_c${c}pillColor`, type: 'color', source: 'seg_source', label: `${n} Pill Text` });
}

// ── Manual KPIs ──
for (let i = 0; i < MAX_KPIS; i++) {
  const n = i + 1;
  const src = `source_${i}`;
  E.push({ name: src, type: 'element', label: `KPI ${n}` });
  E.push({ name: `col_${i}`, type: 'column', source: src, allowMultiple: false, label: 'Value Column' });
  E.push({ name: `label_${i}`, type: 'text', source: src, label: 'Label', placeholder: 'e.g. Revenue', defaultValue: '' });
  E.push({ name: `agg_${i}`, type: 'dropdown', source: src, label: 'Aggregate', values: AGG_VALUES, defaultValue: 'Sum' });
  E.push({ name: `fmt_${i}`, type: 'text', source: src, label: 'Format', placeholder: FMT_PLACEHOLDER, defaultValue: ',.0' });
  E.push({ name: `desc_${i}`, type: 'text', source: src, label: 'Description / Tooltip', placeholder: 'Hover description', defaultValue: '', multiline: true });
  if (i > 0) E.push({ name: `stack_${i}`, type: 'toggle', source: src, label: 'Stack With Previous', defaultValue: false });
  E.push({ name: `clickVal1_${i}`, type: 'text', source: src, label: 'Click → Control 1 Value', placeholder: 'e.g. Closed', defaultValue: '' });
  E.push({ name: `clickVal2_${i}`, type: 'text', source: src, label: 'Click → Control 2 Value', placeholder: 'optional', defaultValue: '' });
  E.push({ name: `action_${i}`, type: 'action-trigger', label: `KPI ${n} — On Click` });

  for (let c = 1; c <= COMP_COUNT; c++) {
    const csrc = `c${c}src_${i}`;
    E.push({ name: csrc, type: 'element', label: `KPI ${n} — ${compName(c)}` });
    E.push({ name: `c${c}col_${i}`, type: 'column', source: csrc, allowMultiple: false, label: 'Column' });
    E.push({ name: `c${c}text_${i}`, type: 'text', source: csrc, label: 'Label', placeholder: compPlaceholder(c), defaultValue: '' });
    E.push({ name: `c${c}fmt_${i}`, type: 'text', source: csrc, label: 'Format', placeholder: FMT_PLACEHOLDER, defaultValue: ',.2' });
    E.push({ name: `c${c}agg_${i}`, type: 'dropdown', source: csrc, label: 'Aggregate', values: AGG_VALUES, defaultValue: 'Sum' });
    E.push({ name: `c${c}style_${i}`, type: 'dropdown', source: csrc, label: 'Style', values: ['Text', 'Pill'], defaultValue: 'Text' });
    E.push({ name: `c${c}pillBg_${i}`, type: 'color', source: csrc, label: 'Pill Bg' });
    E.push({ name: `c${c}pillColor_${i}`, type: 'color', source: csrc, label: 'Pill Text' });
  }
}

// ── Layout & styling ──
E.push({ name: 'cardLayout', type: 'dropdown', label: 'Card Layout', values: ['Stack', 'Grid'], defaultValue: 'Stack' });
E.push({ name: 'cardGap', type: 'dropdown', label: 'KPI Gap (between cards)', values: ['0', '4', '8', '12', '16', '24', '32'], defaultValue: '16' });
E.push({ name: 'cardPadding', type: 'dropdown', label: 'Card Padding', values: ['Auto', '0', '4', '8', '12', '16', '20', '24', '32'], defaultValue: 'Auto' });
E.push({ name: 'containerPadding', type: 'dropdown', label: 'Container Padding', values: ['0', '4', '8', '12', '16', '24', '32'], defaultValue: '4' });
E.push({ name: 'contentGap', type: 'dropdown', label: 'Card Content Spacing', values: ['0', '2', '4', '6', '8', '12', '16', '24'], defaultValue: '8' });
E.push({ name: 'borderStyle', type: 'dropdown', label: 'Card Border', values: ['None', 'Thin', 'Medium', 'Thick'], defaultValue: 'None' });
E.push({ name: 'borderColor', type: 'color', label: 'Border Color' });
E.push({ name: 'borderRadius', type: 'dropdown', label: 'Border Radius', values: ['0', '4', '8', '12', '16', '24'], defaultValue: '8' });
E.push({ name: 'bgColor', type: 'color', label: 'Background Color' });
E.push({ name: 'valueColor', type: 'color', label: 'Value Color' });
E.push({ name: 'labelColor', type: 'color', label: 'Label Color' });
E.push({ name: 'compColor', type: 'color', label: 'Comparison Color' });
E.push({ name: 'valueFontSize', type: 'dropdown', label: 'Value Font Size', values: ['24', '28', '32', '36', '42', '48', '56', '64'], defaultValue: '36' });
E.push({ name: 'compFontSize', type: 'dropdown', label: 'Comparison Font Size', values: ['10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32'], defaultValue: '13' });
E.push({ name: 'labelFontSize', type: 'dropdown', label: 'Label Font Size', values: ['10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32'], defaultValue: '14' });
E.push({ name: 'minCardWidth', type: 'dropdown', label: 'Min Card Width', values: ['100', '150', '200', '250', '300', '400'], defaultValue: '200' });
E.push({ name: 'displayOrder', type: 'text', label: 'Display Order', placeholder: '1,2,3,4,5', defaultValue: '' });
E.push({ name: 'animEnabled', type: 'toggle', label: 'Enable Animation', defaultValue: true });
E.push({ name: 'showInfoIcon', type: 'toggle', label: 'Show Description Tooltips', defaultValue: true });

// ── Click interactions (Control 1/2 are shared; Manual KPIs set hardcoded values) ──
E.push({ name: 'clickVar1', type: 'variable', label: 'Click → Control 1 (Segment Label / KPI value)', allowedTypes: ['text'] });
E.push({ name: 'clickVar2', type: 'variable', label: 'Click → Control 2', allowedTypes: ['text'] });
E.push({ name: 'seg_click2Col', type: 'column', source: 'seg_source', allowMultiple: false, label: 'Control 2 Column (from Segment Source)' });
E.push({ name: 'segAction', type: 'action-trigger', label: 'On Any Card Click (all cards; per-KPI action overrides)' });

client.config.configureEditorPanel(E);

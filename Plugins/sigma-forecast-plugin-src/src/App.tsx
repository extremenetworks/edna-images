import React, { useMemo, useState, useCallback } from 'react';
import {
  client,
  useConfig,
  useElementColumns,
  useVariable,
  useActionTrigger,
  useElementData,
} from '@sigmacomputing/plugin';
import { parseRole, buildTree, buildTreeFromPaths } from './lib/hierarchy';
import { computeRollups } from './lib/rollup';
import { ForecastTable } from './components/ForecastTable';
import type { ForecastRow, TreeNode, MeasureColumn } from './types';

// Editor panel configuration
client.config.configureEditorPanel([
  { name: 'source', type: 'element' },
  { name: 'nameCol', type: 'column', source: 'source', allowMultiple: false, label: 'Name' },
  { name: 'roleCol', type: 'column', source: 'source', allowMultiple: false, label: 'Role (fallback hierarchy)' },
  { name: 'hierarchyCol', type: 'column', source: 'source', allowMultiple: false, label: 'Hierarchy Path (JSON array, optional)' },
  { name: 'dateCol', type: 'column', source: 'source', allowMultiple: false, label: 'Created Date (for latest entry)' },
  { name: 'latestCol', type: 'column', source: 'source', allowMultiple: false, label: 'Latest Submission flag (optional, true = use this row)' },
  { name: 'closedCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Booked (Closed)' },
  { name: 'openCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Open Funnel' },
  { name: 'lowCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Low' },
  { name: 'mlvCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'MLV (Call)' },
  { name: 'highCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'High' },
  { name: 'prevMlvCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk MLV (optional)' },
  { name: 'prevLowCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk Low (optional)' },
  { name: 'prevHighCol', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk High (optional)' },
  { name: 'm1Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M1' },
  { name: 'm2Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M2' },
  { name: 'm3Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M3' },
  { name: 'prevM1Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk M1 (optional)' },
  { name: 'prevM2Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk M2 (optional)' },
  { name: 'prevM3Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'Prev Wk M3 (optional)' },
  { name: 'closedM1Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M1 Booked (optional, for coverage)' },
  { name: 'openM1Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M1 Open Funnel (optional, for coverage)' },
  { name: 'closedM2Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M2 Booked (optional, for coverage)' },
  { name: 'openM2Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M2 Open Funnel (optional, for coverage)' },
  { name: 'closedM3Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M3 Booked (optional, for coverage)' },
  { name: 'openM3Col', type: 'column', source: 'source', allowMultiple: false, allowedTypes: ['number', 'integer'], label: 'M3 Open Funnel (optional, for coverage)' },
  { name: 'submittedCol', type: 'column', source: 'source', allowMultiple: false, label: 'Status (true = green, otherwise red)' },
  { name: 'channelCol', type: 'column', source: 'source', allowMultiple: false, label: 'Channel (MSP/Non-MSP, optional)' },
  { name: 'noteCol', type: 'column', source: 'source', allowMultiple: false, label: 'Note (optional)' },
  { name: 'fcShow', type: 'toggle', label: 'Show Forecast button', defaultValue: true },
  { name: 'showDebug', type: 'toggle', label: 'Show debug panel', defaultValue: false },
  { name: 'fcAction', type: 'action-trigger', label: 'On Forecast Click' },
  { name: 'labelsGroup', type: 'group', label: 'Column Labels (leave blank for default)' },
  { name: 'closedLabel', type: 'text', placeholder: 'Booked', label: 'Booked label' },
  { name: 'openLabel', type: 'text', placeholder: 'Open Funnel', label: 'Open Funnel label' },
  { name: 'lowLabel', type: 'text', placeholder: 'Low', label: 'Low label' },
  { name: 'mlvLabel', type: 'text', placeholder: 'MLV', label: 'MLV label' },
  { name: 'highLabel', type: 'text', placeholder: 'High', label: 'High label' },
  { name: 'm1Label', type: 'text', placeholder: 'M1', label: 'M1 label' },
  { name: 'm2Label', type: 'text', placeholder: 'M2', label: 'M2 label' },
  { name: 'm3Label', type: 'text', placeholder: 'M3', label: 'M3 label' },
  { name: 'selectedUser', type: 'variable', label: 'Selected Username Variable' },
  { name: 'selectedUserId', type: 'variable', label: 'Selected User ID Variable' },
  { name: 'userIdCol', type: 'column', source: 'source', allowMultiple: false, label: 'User ID (column)' },
  { name: 'selectedVar1', type: 'variable', label: 'Selected Variable 1' },
  { name: 'selectedVar1Col', type: 'column', source: 'source', allowMultiple: false, label: 'Selected Variable 1 value (column)' },
  { name: 'selectedVar2', type: 'variable', label: 'Selected Variable 2' },
  { name: 'selectedVar2Col', type: 'column', source: 'source', allowMultiple: false, label: 'Selected Variable 2 value (column)' },
  { name: 'selectedVar3', type: 'variable', label: 'Selected Variable 3' },
  { name: 'selectedVar3Col', type: 'column', source: 'source', allowMultiple: false, label: 'Selected Variable 3 value (column)' },
  { name: 'rowClickAction', type: 'action-trigger', label: 'On Notes Click' },
  { name: 'numberClickAction', type: 'action-trigger', label: 'On Number Click' },
  { name: 'monthControl', type: 'variable', label: 'Month Variable (1/2/3 on M1/M2/M3 click)' },
]);

/** One control the plugin tried to set on a click, for the debug panel. */
interface DebugSet {
  label: string;
  control: string;
  column: string | null;
  columnInData: boolean | null;
  value: string;
  error: string | null;
}

interface DebugClick {
  kind: string;
  person: string;
  rowIndex: number | null;
  action: string | null;
  sent: DebugSet[];
  /** The clicked person's own values, including hidden prev-week and monthly funnel ones */
  values?: Record<string, number>;
}

/** Month variable value set when an M1/M2/M3 number is clicked. */
const MONTH_BY_KEY: Record<string, string> = { m1: '1', m2: '2', m3: '3' };

/** Measures stored per week in the source and summed across all of a person's rows. */
const SUMMED_ACROSS_ROWS = new Set(['closed', 'open', 'closedM1', 'closedM2', 'closedM3', 'openM1', 'openM2', 'openM3']);

/** Config values for actions, variables and text are strings; ignore anything else. */
function configString(value: unknown): string {
  if (typeof value === 'string') return value;
  // Column configs can arrive as a single-item array
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return '';
}

/** Toggle values may arrive as booleans, strings or numbers; unset falls back to the default. */
function configBool(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'false' || value === 0 || value === '0') return false;
  if (value === 'true' || value === 1 || value === '1') return true;
  return defaultValue;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || '??').toUpperCase();
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

function tryParseArray(val: unknown): string[] | null {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* not valid JSON */ }
  }
  return null;
}

/** Walk the tree and merge siblings that share a name but differ by channel. */
function groupChannelNodes(node: TreeNode): void {
  // Process children first (bottom-up)
  for (const child of node.children) {
    groupChannelNodes(child);
  }

  // Group children by name where channel is set
  const byName = new Map<string, TreeNode[]>();
  for (const child of node.children) {
    if (child.channel) {
      const group = byName.get(child.name) || [];
      group.push(child);
      byName.set(child.name, group);
    }
  }

  // For any name with 2+ channel variants, create a synthetic parent
  for (const [name, variants] of byName) {
    if (variants.length < 2) continue;

    const first = variants[0];
    const syntheticParent: TreeNode = {
      id: `channel-group-${node.id}-${name}`,
      name,
      role: first.role,
      initials: first.initials,
      parsed: first.parsed,
      entered: {},
      rolledUp: {},
      submitted: first.submitted,
      hierarchyPath: first.hierarchyPath,
      channel: null,
      rowIndex: null,
      children: variants.map((v) => {
        // Rename children to show channel label instead of person name
        return { ...v, name: v.channel!, isLeaf: true, children: [] };
      }),
      isLeaf: false,
    };

    // Replace the original variants with the synthetic parent
    const variantIds = new Set(variants.map((v) => v.id));
    node.children = node.children.filter((c) => !variantIds.has(c.id));
    node.children.push(syntheticParent);
  }
}

function App() {
  // Sigma sometimes sends config updates that omit keys it already sent, so a missing
  // key means "unchanged". Merge each update over the last known values.
  const latestConfig = useConfig();
  const configRef = React.useRef<Record<string, unknown>>({});
  const config = useMemo(() => {
    const merged = { ...configRef.current };
    for (const [k, v] of Object.entries(latestConfig ?? {})) {
      if (v !== undefined) merged[k] = v;
    }
    configRef.current = merged;
    return merged as typeof latestConfig;
  }, [latestConfig]);
  const sourceId = (config.source as string) || '';
  const data = useElementData(sourceId);
  const columns = useElementColumns(sourceId);

  const nameColId = (config.nameCol as string) || '';
  const roleColId = (config.roleCol as string) || '';
  const hierarchyColId = (config.hierarchyCol as string) || '';
  const dateColId = (config.dateCol as string) || '';
  const latestColId = configString(config.latestCol);
  const submittedColId = (config.submittedCol as string) || '';
  const channelColId = (config.channelCol as string) || '';

  // Sigma variable + action for the Notes icon. Sigma resolves both by the ID stored in
  // the config field, not by the config key name.
  // Read every value from the full config: the SDK's useConfig('key') can return the
  // whole config object when a key is unchanged/unset, which Sigma rejects with
  // "Invalid plugin action trigger id [object Object]".
  const selectedUserControl = configString(config.selectedUser);
  const [, setSelectedUser] = useVariable(selectedUserControl);
  const rowClickActionConfig = configString(config.rowClickAction);
  const triggerRowClick = useActionTrigger(rowClickActionConfig);

  // Extra variables work like the username: on any Notes or Forecast click, each is set
  // to the clicked person's value in its mapped column.
  const selectedUserIdControl = configString(config.selectedUserId);
  const [, setSelectedUserId] = useVariable(selectedUserIdControl);
  const userIdCol = configString(config.userIdCol);
  const selectedVar1Control = configString(config.selectedVar1);
  const [, setSelectedVar1] = useVariable(selectedVar1Control);
  const selectedVar1Col = configString(config.selectedVar1Col);
  const selectedVar2Control = configString(config.selectedVar2);
  const [, setSelectedVar2] = useVariable(selectedVar2Control);
  const selectedVar2Col = configString(config.selectedVar2Col);
  const selectedVar3Control = configString(config.selectedVar3);
  const [, setSelectedVar3] = useVariable(selectedVar3Control);
  const selectedVar3Col = configString(config.selectedVar3Col);

  const setPersonVariables = useCallback((node: TreeNode): DebugSet[] => {
    // Placeholder ancestors have no source row, so they have no column values
    // The person's latest row can leave descriptive columns blank, so fall back to
    // any of their rows that has a value
    const valueFrom = (colId: string) => {
      if (!colId || node.rowIndex == null) return '';
      const col = data[colId];
      if (!col) return '';
      const own = col[node.rowIndex];
      if (own != null && String(own).trim() !== '') return String(own);
      const names = nameColId ? data[nameColId] : undefined;
      if (!names) return '';
      for (let i = 0; i < col.length; i++) {
        const v = col[i];
        if (v != null && String(v).trim() !== '' && String(names[i] ?? '').trim() === node.name) return String(v);
      }
      return '';
    };
    const sent: DebugSet[] = [];
    const send = (label: string, control: string, column: string | null, value: string, set: Function) => {
      if (!control) return;
      let error: string | null = null;
      try { set(value); } catch (e) { error = String(e); }
      sent.push({ label, control, column, columnInData: column ? column in data : null, value, error });
    };
    send('Username', selectedUserControl, null, node.name, setSelectedUser);
    send('User ID', selectedUserIdControl, userIdCol || null, valueFrom(userIdCol), setSelectedUserId);
    send('Variable 1', selectedVar1Control, selectedVar1Col || null, valueFrom(selectedVar1Col), setSelectedVar1);
    send('Variable 2', selectedVar2Control, selectedVar2Col || null, valueFrom(selectedVar2Col), setSelectedVar2);
    send('Variable 3', selectedVar3Control, selectedVar3Col || null, valueFrom(selectedVar3Col), setSelectedVar3);
    return sent;
  }, [
    selectedUserControl, setSelectedUser, data, nameColId,
    selectedUserIdControl, setSelectedUserId, userIdCol,
    selectedVar1Control, setSelectedVar1, selectedVar1Col,
    selectedVar2Control, setSelectedVar2, selectedVar2Col,
    selectedVar3Control, setSelectedVar3, selectedVar3Col,
  ]);

  // Number click: sets the same variables as Notes, plus the month variable (1/2/3 for
  // M1/M2/M3, cleared for other columns), then fires its own action.
  const numberClickActionConfig = configString(config.numberClickAction);
  const triggerNumberClick = useActionTrigger(numberClickActionConfig);
  const monthControl = configString(config.monthControl);
  const [, setMonth] = useVariable(monthControl);
  // Debug panel (settings toggle): shows what the last click read and sent
  const showDebug = configBool(config.showDebug, false);
  const [lastClick, setLastClick] = useState<DebugClick | null>(null);
  const recordClick = useCallback((click: DebugClick) => {
    if (showDebug) setLastClick(click);
  }, [showDebug]);

  const handleNumberClick = useCallback((node: TreeNode, measureKey: string) => {
    const sent = setPersonVariables(node);
    if (monthControl) {
      const month = MONTH_BY_KEY[measureKey] ?? '';
      let error: string | null = null;
      try { setMonth(month); } catch (e) { error = String(e); }
      sent.push({ label: 'Month', control: monthControl, column: null, columnInData: null, value: month, error });
    }
    if (numberClickActionConfig) triggerNumberClick();
    recordClick({ kind: `Number (${measureKey})`, person: node.name, rowIndex: node.rowIndex, values: node.entered, action: numberClickActionConfig || null, sent });
  }, [setPersonVariables, monthControl, setMonth, numberClickActionConfig, triggerNumberClick, recordClick]);

  const handleRowClick = useCallback((node: TreeNode) => {
    const sent = setPersonVariables(node);
    if (rowClickActionConfig) triggerRowClick();
    recordClick({ kind: 'Notes', person: node.name, rowIndex: node.rowIndex, values: node.entered, action: rowClickActionConfig || null, sent });
  }, [setPersonVariables, rowClickActionConfig, triggerRowClick, recordClick]);

  // Forecast button: sets the same variables as Notes, then fires its own action.
  // Shown whenever the "Show Forecast button" toggle is on (default).
  // Sigma follows a toggle change with a config update that omits the key, so an
  // unset value means "unchanged", not "back to default". Keep the last value received.
  const [showForecast, setShowForecast] = useState(() => configBool(config.fcShow, true));
  React.useEffect(() => {
    if (config.fcShow !== undefined && config.fcShow !== null) {
      setShowForecast(configBool(config.fcShow, true));
    }
  }, [config.fcShow]);

  const forecastActionConfig = configString(config.fcAction);
  const triggerForecast = useActionTrigger(forecastActionConfig);

  const handleForecastClick = useCallback((node: TreeNode) => {
    const sent = setPersonVariables(node);
    if (forecastActionConfig) triggerForecast();
    recordClick({ kind: 'Forecast', person: node.name, rowIndex: node.rowIndex, values: node.entered, action: forecastActionConfig || null, sent });
  }, [setPersonVariables, forecastActionConfig, triggerForecast, recordClick]);

  // Measure column definitions
  const measureDefs = useMemo(() => {
    const defs: { key: string; configKey: string; label: string }[] = [
      { key: 'closed', configKey: 'closedCol', label: 'Booked' },
      { key: 'open', configKey: 'openCol', label: 'Open Funnel' },
      { key: 'low', configKey: 'lowCol', label: 'Low' },
      { key: 'mlv', configKey: 'mlvCol', label: 'MLV' },
      { key: 'prevMlv', configKey: 'prevMlvCol', label: 'Prev Wk MLV' },
      { key: 'prevLow', configKey: 'prevLowCol', label: 'Prev Wk Low' },
      { key: 'prevHigh', configKey: 'prevHighCol', label: 'Prev Wk High' },
      { key: 'high', configKey: 'highCol', label: 'High' },
      { key: 'm1', configKey: 'm1Col', label: 'M1' },
      { key: 'm2', configKey: 'm2Col', label: 'M2' },
      { key: 'm3', configKey: 'm3Col', label: 'M3' },
      { key: 'prevM1', configKey: 'prevM1Col', label: 'Prev Wk M1' },
      { key: 'closedM1', configKey: 'closedM1Col', label: 'M1 Booked' },
      { key: 'openM1', configKey: 'openM1Col', label: 'M1 Open Funnel' },
      { key: 'prevM2', configKey: 'prevM2Col', label: 'Prev Wk M2' },
      { key: 'closedM2', configKey: 'closedM2Col', label: 'M2 Booked' },
      { key: 'openM2', configKey: 'openM2Col', label: 'M2 Open Funnel' },
      { key: 'prevM3', configKey: 'prevM3Col', label: 'Prev Wk M3' },
      { key: 'closedM3', configKey: 'closedM3Col', label: 'M3 Booked' },
      { key: 'openM3', configKey: 'openM3Col', label: 'M3 Open Funnel' },
    ];
    return defs;
  }, []);

  // Custom column labels from the editor panel (blank keeps the default).
  // labelKey is rebuilt every render so the memo below picks up text edits.
  const labelOverrides: Record<string, string> = {
    closed: configString(config.closedLabel),
    open: configString(config.openLabel),
    low: configString(config.lowLabel),
    mlv: configString(config.mlvLabel),
    high: configString(config.highLabel),
    m1: configString(config.m1Label),
    m2: configString(config.m2Label),
    m3: configString(config.m3Label),
  };
  const labelKey = Object.values(labelOverrides).map((v) => v ?? '').join('\u0000');

  // All mapped columns (including hidden prev-week ones used for delta computation)
  const allMeasureColumns: MeasureColumn[] = useMemo(() => {
    const result: MeasureColumn[] = [];
    for (const def of measureDefs) {
      const colId = (config[def.configKey] as string) || '';
      if (colId) {
        const custom = String(labelOverrides[def.key] ?? '').trim();
        result.push({ key: def.key, colId, label: custom || def.label });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, measureDefs, labelKey]);

  // Visible columns exclude prev-week columns (their deltas show as badges) and the monthly
  // funnel columns (they only feed the M1-M3 coverage bars)
  const HIDDEN_KEYS = new Set([
    'prevMlv', 'prevLow', 'prevHigh',
    'prevM1', 'prevM2', 'prevM3',
    'closedM1', 'closedM2', 'closedM3',
    'openM1', 'openM2', 'openM3',
  ]);
  const measureColumns: MeasureColumn[] = useMemo(
    () => allMeasureColumns.filter((mc) => !HIDDEN_KEYS.has(mc.key)),
    [allMeasureColumns],
  );

  // Build tree
  const tree = useMemo(() => {
    if (!nameColId) return null;
    // Need at least one of roleCol or hierarchyCol
    if (!roleColId && !hierarchyColId) return null;

    const names = data[nameColId];
    const roles = roleColId ? data[roleColId] : null;
    const hierarchyData = hierarchyColId ? data[hierarchyColId] : null;
    if (!names || names.length === 0) return null;

    const rowCount = names.length;

    // Deduplicate: keep only the most recent entry per name+role
    // using the date column to determine which is latest
    const dateData = dateColId ? data[dateColId] : null;
    const latestData = latestColId ? data[latestColId] : null;

    // First pass: find the best (most recent) row index for each name+role
    const bestRowIndex = new Map<string, number>();
    // Every row per person, for measures that are summed across rows (weekly funnel)
    const rowsByKey = new Map<string, number[]>();

    for (let i = 0; i < rowCount; i++) {
      const name = names[i] != null ? String(names[i]).trim() : '';
      const role = roles ? (roles[i] != null ? String(roles[i]).trim() : '') : '';
      if (!name) continue;
      // Skip empty roles only when not using hierarchy path
      if (!hierarchyData && !role) continue;

      // Include the hierarchy path so a person appearing at two positions
      // (e.g. as their own direct report) keeps both rows
      const pathKey = hierarchyData && hierarchyData[i] != null
        ? (Array.isArray(hierarchyData[i]) ? JSON.stringify(hierarchyData[i]) : String(hierarchyData[i]))
        : '';
      const dedupeKey = `${name}|||${role}|||${pathKey}`;
      rowsByKey.set(dedupeKey, [...(rowsByKey.get(dedupeKey) ?? []), i]);
      const existing = bestRowIndex.get(dedupeKey);

      if (existing === undefined) {
        bestRowIndex.set(dedupeKey, i);
      } else if (dateData) {
        // Compare dates: keep the row with the later date
        const existingDate = dateData[existing];
        const currentDate = dateData[i];
        if (currentDate != null && (existingDate == null || isLater(currentDate, existingDate))) {
          bestRowIndex.set(dedupeKey, i);
        }
      }
      // If no date column, keep the first occurrence
    }

    // People with a true status on any of their rows
    const trueNames = new Set<string>();
    const statusData = submittedColId ? data[submittedColId] : null;
    if (statusData) {
      for (let r = 0; r < rowCount; r++) {
        const raw = statusData[r];
        if (isTrue(raw)) {
          const n = names[r] != null ? String(names[r]).trim() : '';
          if (n) trueNames.add(n);
        }
      }
    }

    // Second pass: build rows from the winning indices
    const rows: ForecastRow[] = [];
    for (const [dedupeKey, i] of bestRowIndex) {
      const name = String(names[i]).trim();
      let role = roles ? String(roles[i] ?? '').trim() : '';

      // Parse hierarchy path from the dedicated column OR from the role column if it's JSON
      let hierarchyPath: string[] | null = null;

      // Try dedicated hierarchy column first
      if (hierarchyData && hierarchyData[i] != null) {
        hierarchyPath = tryParseArray(hierarchyData[i]);
      }

      // If no dedicated column or it didn't parse, check if role column contains a JSON array
      if (!hierarchyPath && role.startsWith('[')) {
        hierarchyPath = tryParseArray(role);
        if (hierarchyPath) role = ''; // clear role since it was actually a hierarchy path
      }

      // Row flagged as the person's latest submission, if a flag column is mapped
      let forecastRow: number | null = null;
      if (latestData) {
        for (const r of rowsByKey.get(dedupeKey) ?? [i]) {
          if (isTrue(latestData[r])) { forecastRow = r; break; }
        }
      }

      const values: Record<string, number | null> = {};
      for (const mc of allMeasureColumns) {
        if (mc.colId === '__computed__') continue;
        const colData = data[mc.colId];
        if (!colData) { values[mc.key] = null; continue; }
        if (SUMMED_ACROSS_ROWS.has(mc.key)) {
          // Booked and Open Funnel hold one week's amount per row; the quarter total is
          // the sum over every week in the source
          let total: number | null = null;
          for (const r of rowsByKey.get(dedupeKey) ?? [i]) {
            const v = toNum(colData[r]);
            if (v != null) total = (total ?? 0) + v;
          }
          values[mc.key] = total;
        } else {
          // Forecast values only exist on submission weeks; use the flagged latest row or the
          // chosen row, else the person's most recent row that has a value
          // With a latest-submission flag mapped, that row wins
          let v = forecastRow != null ? toNum(colData[forecastRow]) : toNum(colData[i]);
          if (v == null) {
            let bestDate: unknown = null;
            for (const r of rowsByKey.get(dedupeKey) ?? []) {
              const rv = toNum(colData[r]);
              if (rv == null) continue;
              const d = dateData ? dateData[r] : null;
              if (v == null || (d != null && (bestDate == null || isLater(d, bestDate)))) { v = rv; bestDate = d; }
            }
          }
          values[mc.key] = v;
        }
      }

      // Compute W:W deltas
      values.mlvWoW = (values.mlv != null && values.prevMlv != null) ? values.mlv - values.prevMlv : null;
      values.lowWoW = (values.low != null && values.prevLow != null) ? values.low - values.prevLow : null;
      values.highWoW = (values.high != null && values.prevHigh != null) ? values.high - values.prevHigh : null;
      for (const m of ['m1', 'm2', 'm3']) {
        const cur = values[m];
        const prev = values[`prev${m.toUpperCase()}`];
        values[`${m}WoW`] = cur != null && prev != null ? cur - prev : null;
      }

      // Status: green when the mapped column is true on any row for this person (only
      // the current week's row is ever true upstream)
      const submitted = submittedColId ? trueNames.has(name) : null;

      // Read channel
      let channel: string | null = null;
      if (channelColId) {
        const chData = data[channelColId];
        if (chData && chData[i] != null) {
          const v = String(chData[i]).trim();
          if (v) channel = v;
        }
      }

      rows.push({ name, role, values, submitted, hierarchyPath, channel, rowIndex: i });
    }

    // Parse roles and build tree nodes
    const nodes: TreeNode[] = rows.map((row, idx) => ({
      id: `node-${idx}`,
      name: row.name,
      role: row.role,
      initials: getInitials(row.name),
      parsed: parseRole(row.role),
      entered: Object.fromEntries(
        Object.entries(row.values).filter(([, v]) => v != null).map(([k, v]) => [k, v as number])
      ),
      rolledUp: {},
      submitted: row.submitted,
      hierarchyPath: row.hierarchyPath,
      channel: row.channel,
      rowIndex: row.rowIndex,
      children: [],
      isLeaf: false,
    }));

    // Use hierarchy path builder if any node has a path, otherwise fall back to role-based
    const hasAnyPath = nodes.some((n) => n.hierarchyPath && n.hierarchyPath.length > 0);
    const root = hasAnyPath ? buildTreeFromPaths(nodes) : buildTree(nodes);
    if (!root) return null;

    // Group channel sub-nodes: if siblings share the same name but have different
    // channel values (e.g., MSP / Non-MSP), merge them under a synthetic parent
    // that shows the total, with channel breakdowns as children.
    if (channelColId) {
      groupChannelNodes(root);
    }

    const measureKeys = allMeasureColumns.map((mc) => mc.key);
    computeRollups(root, measureKeys);

    return root;
  }, [data, nameColId, roleColId, hierarchyColId, dateColId, latestColId, submittedColId, channelColId, allMeasureColumns]);

  // Expand/collapse state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Auto-expand top 2 levels on first render
  useMemo(() => {
    if (tree && !initialized) {
      const ids = new Set<string>();
      ids.add(tree.id);
      for (const child of tree.children) {
        ids.add(child.id);
      }
      setExpandedIds(ids);
      setInitialized(true);
    }
  }, [tree, initialized]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Focus: clicking a name shows only that person's subtree; ancestors go in a breadcrumb
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusPath = useMemo(
    () => (tree && focusId ? findPath(tree, focusId) : null),
    [tree, focusId],
  );
  const handleFocus = useCallback((nodeId: string) => {
    if (tree && nodeId === tree.id) {
      setFocusId(null);
      return;
    }
    setFocusId(nodeId);
    setExpandedIds((prev) => new Set(prev).add(nodeId));
  }, [tree]);
  const clearFocus = useCallback(() => setFocusId(null), []);

  if (!sourceId) {
    return <div className="plugin-message">Select a data source in the plugin configuration.</div>;
  }
  if (!nameColId || (!roleColId && !hierarchyColId)) {
    return <div className="plugin-message">Map the Name column and either Role or Hierarchy Path in the plugin configuration.</div>;
  }
  if (!tree) {
    return <div className="plugin-message">Loading forecast data...</div>;
  }

  // If the focused node disappears after a data refresh, fall back to the full tree
  const displayRoot = focusPath ? focusPath[focusPath.length - 1] : tree;
  const ancestors = focusPath ? focusPath.slice(0, -1) : [];

  return (
    <>
    <ForecastTable
      root={displayRoot}
      ancestors={ancestors}
      measureColumns={measureColumns}
      expandedIds={expandedIds}
      onToggle={toggleExpand}
      onRowClick={rowClickActionConfig ? handleRowClick : undefined}
      onForecastClick={showForecast ? handleForecastClick : undefined}
      onNumberClick={numberClickActionConfig || monthControl ? handleNumberClick : undefined}
      onFocus={handleFocus}
      onClearFocus={clearFocus}
    />
    {showDebug && <DebugPanel config={config} lastClick={lastClick} statusCol={submittedColId} statusData={submittedColId ? data[submittedColId] : undefined} />}
    </>
  );
}

/** Settings and last-click details, shown when "Show debug panel" is on. */
function DebugPanel({ config, lastClick, statusCol, statusData }: {
  config: Record<string, unknown>;
  lastClick: DebugClick | null;
  statusCol: string;
  statusData: unknown[] | undefined;
}) {
  // Distinct raw status values with their types, to check what counts as true
  const statusValues = statusData
    ? Array.from(new Set(statusData.map((v) => `${JSON.stringify(v)} (${v === null ? 'null' : typeof v})`))).slice(0, 8)
    : [];
  return (
    <div className="debug-panel">
      <div className="debug-title">Debug</div>
      <div>Saved settings: {Object.keys(config).sort().join(', ')}</div>
      <div>
        Status column: {statusCol || 'not mapped'}
        {statusCol && (statusData ? ` (loaded, ${statusData.length} rows) values: ${statusValues.join(', ')}` : ' (NOT loaded - reopen the workbook)')}
      </div>
      {!lastClick ? (
        <div>Click Notes, Forecast or a number to see what is sent.</div>
      ) : (
        <>
          <div>
            Last click: {lastClick.kind} on {lastClick.person} (row {lastClick.rowIndex ?? 'none'}), action:{' '}
            {lastClick.action ?? 'not set'}
          </div>
          {lastClick.values && (
            <div>
              Values: {Object.entries(lastClick.values).map(([k, v]) => `${k}=${Math.round(v)}`).join(', ') || 'none'}
            </div>
          )}
          {lastClick.sent.length === 0 && <div>No controls set (none configured).</div>}
          {lastClick.sent.map((d) => (
            <div key={d.label}>
              {d.label} → {d.control}: "{d.value}"
              {d.column && ` (column ${d.columnInData ? 'loaded' : 'NOT loaded'})`}
              {d.error && ` ERROR: ${d.error}`}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** True for boolean true, 1 or the text "true". */
function isTrue(raw: unknown): boolean {
  return raw === true || raw === 1 || (typeof raw === 'string' && raw.trim().toLowerCase() === 'true');
}

/** Whether date a is later than b. Sigma sends dates as epoch numbers, so compare those
 * numerically; text comparison would rank "999..." above "1000...". */
function isLater(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a > b;
  const ta = Date.parse(String(a));
  const tb = Date.parse(String(b));
  if (!isNaN(ta) && !isNaN(tb)) return ta > tb;
  return String(a) > String(b);
}

/** Path of nodes from root down to the node with the given id, or null if not found. */
function findPath(node: TreeNode, id: string): TreeNode[] | null {
  if (node.id === id) return [node];
  for (const child of node.children) {
    const sub = findPath(child, id);
    if (sub) return [node, ...sub];
  }
  return null;
}

export default App;

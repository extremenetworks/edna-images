import React, { useMemo, useState, useCallback } from 'react';
import {
  client,
  useConfig,
  useElementData,
  useElementColumns,
  useVariable,
  useActionTrigger,
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
  { name: 'submittedCol', type: 'column', source: 'source', allowMultiple: false, label: 'Submitted This Week (optional)' },
  { name: 'channelCol', type: 'column', source: 'source', allowMultiple: false, label: 'Channel (MSP/Non-MSP, optional)' },
  { name: 'noteCol', type: 'column', source: 'source', allowMultiple: false, label: 'Note (optional)' },
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
  { name: 'rowClickAction', type: 'action-trigger', label: 'On Notes Click' },
  { name: 'showForecast', type: 'toggle', label: 'Show Forecast button', defaultValue: true },
  { name: 'forecastAction', type: 'action-trigger', label: 'On Forecast Click' },
]);

/** Config values for actions, variables and text are strings; ignore anything else. */
function configString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
  const config = useConfig();
  const sourceId = (config.source as string) || '';
  const data = useElementData(sourceId);
  const columns = useElementColumns(sourceId);

  const nameColId = (config.nameCol as string) || '';
  const roleColId = (config.roleCol as string) || '';
  const hierarchyColId = (config.hierarchyCol as string) || '';
  const dateColId = (config.dateCol as string) || '';
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

  const handleRowClick = useCallback((name: string) => {
    if (selectedUserControl) setSelectedUser(name);
    if (rowClickActionConfig) triggerRowClick();
  }, [selectedUserControl, setSelectedUser, rowClickActionConfig, triggerRowClick]);

  // Forecast button: sets the same username control, then fires its own action.
  // Shown whenever the "Show Forecast button" toggle is on (default).
  const showForecast = config.showForecast !== false;
  const forecastActionConfig = configString(config.forecastAction);
  const triggerForecast = useActionTrigger(forecastActionConfig);

  const handleForecastClick = useCallback((name: string) => {
    if (selectedUserControl) setSelectedUser(name);
    if (forecastActionConfig) triggerForecast();
  }, [selectedUserControl, setSelectedUser, forecastActionConfig, triggerForecast]);

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

  // Visible columns exclude prev-week columns (their deltas show as badges on Low/MLV/High)
  const HIDDEN_KEYS = new Set(['prevMlv', 'prevLow', 'prevHigh']);
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

    // First pass: find the best (most recent) row index for each name+role
    const bestRowIndex = new Map<string, number>();

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
      const existing = bestRowIndex.get(dedupeKey);

      if (existing === undefined) {
        bestRowIndex.set(dedupeKey, i);
      } else if (dateData) {
        // Compare dates: keep the row with the later date
        const existingDate = dateData[existing];
        const currentDate = dateData[i];
        if (currentDate != null && (existingDate == null || String(currentDate) > String(existingDate))) {
          bestRowIndex.set(dedupeKey, i);
        }
      }
      // If no date column, keep the first occurrence
    }

    // Second pass: build rows from the winning indices
    const rows: ForecastRow[] = [];
    const winningIndices = new Set(bestRowIndex.values());

    for (const i of winningIndices) {
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

      const values: Record<string, number | null> = {};
      for (const mc of allMeasureColumns) {
        if (mc.colId === '__computed__') continue;
        const colData = data[mc.colId];
        values[mc.key] = colData ? toNum(colData[i]) : null;
      }

      // Compute W:W deltas
      values.mlvWoW = (values.mlv != null && values.prevMlv != null) ? values.mlv - values.prevMlv : null;
      values.lowWoW = (values.low != null && values.prevLow != null) ? values.low - values.prevLow : null;
      values.highWoW = (values.high != null && values.prevHigh != null) ? values.high - values.prevHigh : null;

      // Read submitted boolean
      let submitted: boolean | null = null;
      if (submittedColId) {
        const subData = data[submittedColId];
        if (subData) {
          const raw = subData[i];
          if (typeof raw === 'boolean') submitted = raw;
          else if (raw === 'true' || raw === true || raw === 1) submitted = true;
          else if (raw === 'false' || raw === false || raw === 0) submitted = false;
          else if (raw != null) submitted = Boolean(raw);
        }
      }

      // Read channel
      let channel: string | null = null;
      if (channelColId) {
        const chData = data[channelColId];
        if (chData && chData[i] != null) {
          const v = String(chData[i]).trim();
          if (v) channel = v;
        }
      }

      rows.push({ name, role, values, submitted, hierarchyPath, channel });
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
  }, [data, nameColId, roleColId, allMeasureColumns]);

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
    <ForecastTable
      root={displayRoot}
      ancestors={ancestors}
      measureColumns={measureColumns}
      expandedIds={expandedIds}
      onToggle={toggleExpand}
      onRowClick={rowClickActionConfig ? handleRowClick : undefined}
      onForecastClick={showForecast ? handleForecastClick : undefined}
      onFocus={handleFocus}
      onClearFocus={clearFocus}
    />
  );
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

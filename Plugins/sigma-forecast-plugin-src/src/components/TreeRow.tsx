import React from 'react';
import type { TreeNode, MeasureColumn } from '../types';
import { DualValueCell } from './DualValueCell';
import type { CoverageData } from './DualValueCell';

// Funnel measures are pure sums of the subtree; show the sum as the primary value
const FUNNEL_KEYS = new Set(['closed', 'open']);

// Measures that show a change-since-last-week arrow (value minus its Prev Wk column)
const DELTA_KEYS = new Set(['low', 'mlv', 'high', 'm1', 'm2', 'm3']);

// Monthly funnel keys behind each month's coverage bar
const MONTH_FUNNEL: Record<string, { closed: string; open: string }> = {
  m1: { closed: 'closedM1', open: 'openM1' },
  m2: { closed: 'closedM2', open: 'openM2' },
  m3: { closed: 'closedM3', open: 'openM3' },
};

interface Props {
  node: TreeNode;
  depth: number;
  measureColumns: MeasureColumn[];
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  onRowClick?: (node: TreeNode) => void;
  onForecastClick?: (node: TreeNode) => void;
  onNumberClick?: (node: TreeNode, measureKey: string) => void;
  forecastLeft?: number;
  lastFrozen?: 'status' | 'notes' | 'forecast';
  onFocus?: (nodeId: string) => void;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TreeRow({ node, depth, measureColumns, isExpanded, onToggle, onRowClick, onForecastClick, onNumberClick, forecastLeft, lastFrozen = 'status', onFocus, isHovered, onMouseEnter, onMouseLeave }: Props) {
  const hasChildren = node.children.length > 0;
  const isAggregate = !node.isLeaf;
  const indentPx = depth * 24;
  // Placeholder ancestors have no data row (and so no notes) in the source
  const isPlaceholder = node.id.startsWith('placeholder-');

  // Green only when the upstream status column is true
  const submitted = node.submitted === true;

  // Build role display: use hierarchy path region if available, otherwise parse from role
  let roleDisplay: string;
  if (node.parsed.orgPath && node.parsed.level && node.parsed.orgPath !== node.parsed.level) {
    // Role-based parsing: "Region/Sub" orgPath + level suffix → "Sub · <suffix>"
    const orgParts = node.parsed.orgPath.split('/');
    roleDisplay = `${orgParts[orgParts.length - 1]} · ${node.parsed.level}`;
  } else if (node.parsed.orgPath) {
    // Path-based: orgPath = region (e.g., "GCR"), level = same → just show region
    roleDisplay = node.parsed.orgPath;
  } else {
    roleDisplay = node.parsed.level || node.role;
  }

  // Funnel value for a key: the subtree total on aggregate rows, the person's own otherwise
  const funnel = (key: string) => (isAggregate ? (node.rolledUp[key] ?? node.entered[key]) : node.entered[key]) ?? 0;

  // Coverage bar (booked + open against the forecast) for MLV and, when the monthly funnel
  // is mapped, M1-M3
  const coverageFor = (key: string, label: string): CoverageData | null => {
    const total = node.entered[key] ?? null;
    if (total == null || total <= 0) return null;
    if (key === 'mlv') return { closed: funnel('closed'), open: funnel('open'), total, label };
    const month = MONTH_FUNNEL[key];
    // Only when at least one monthly funnel column is mapped for this month
    if (!month) return null;
    const has = (k: string) => k in node.entered || k in node.rolledUp;
    if (!has(month.closed) && !has(month.open)) return null;
    return { closed: funnel(month.closed), open: funnel(month.open), total, label };
  };

  const rowCls = `tree-row ${isAggregate ? 'aggregate-row' : 'leaf-row'} depth-${Math.min(depth, 4)}${isHovered ? ' row-hovered' : ''}`;

  return (
    <tr className={rowCls} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <td className="col-name td-sticky">
        <div className="name-cell" style={{ paddingLeft: `${indentPx}px` }}>
          {hasChildren ? (
            <button
              className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={() => onToggle(node.id)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="expand-spacer" />
          )}
          <span className={`avatar depth-color-${Math.min(depth, 4)}`}>
            {node.initials}
          </span>
          <div className="name-info">
            {onFocus && hasChildren ? (
              <button
                className="name-text name-focus"
                onClick={() => onFocus(node.id)}
                title={`Focus on ${node.name}'s hierarchy`}
              >
                {node.name}
              </button>
            ) : (
              <span className="name-text" title={node.name}>{node.name}</span>
            )}
            <span className="role-text">{roleDisplay}</span>
          </div>
        </div>
      </td>
      <td className={`col-status td-sticky td-sticky-status${lastFrozen === 'status' ? ' frozen-edge' : ''}`}>
        <StatusDot submitted={submitted} />
      </td>
      {onRowClick && (
        <td className={`col-notes td-sticky td-sticky-notes${lastFrozen === 'notes' ? ' frozen-edge' : ''}`}>
          {!isPlaceholder && (
            <NoteButton name={node.name} onClick={() => onRowClick(node)} />
          )}
        </td>
      )}
      {onForecastClick && (
        <td className="col-forecast td-sticky frozen-edge" style={{ left: forecastLeft }}>
          {!isPlaceholder && (
            <ForecastButton name={node.name} onClick={() => onForecastClick(node)} />
          )}
        </td>
      )}
      {measureColumns.map((mc) => (
        <td
          key={mc.key}
          className={`col-measure${onNumberClick && !isPlaceholder ? ' number-clickable' : ''}`}
          onClick={onNumberClick && !isPlaceholder ? () => onNumberClick(node, mc.key) : undefined}
          title={onNumberClick && !isPlaceholder ? `${mc.label}: ${node.name}` : undefined}
        >
          <DualValueCell
            entered={FUNNEL_KEYS.has(mc.key) && isAggregate
              ? (node.rolledUp[mc.key] ?? null)
              : (node.entered[mc.key] ?? null)}
            rolledUp={isAggregate && !FUNNEL_KEYS.has(mc.key) ? (node.rolledUp[mc.key] ?? null) : null}
            isAggregate={isAggregate}
            isWoW={mc.key === 'mlvWoW'}
            delta={DELTA_KEYS.has(mc.key) ? (node.entered[`${mc.key}WoW`] ?? null) : null}
            coverage={coverageFor(mc.key, mc.label)}
          />
        </td>
      ))}
    </tr>
  );
}

function StatusDot({ submitted }: { submitted: boolean }) {
  return (
    <span
      className={`status-dot ${submitted ? 'status-submitted' : 'status-missing'}`}
      title={submitted ? 'Forecast submitted' : 'No forecast submitted'}
    />
  );
}

/** Opens the person's forecast notes by firing the plugin's row-click action. */
export function NoteButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      className="note-btn"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`View ${name}'s forecast notes`}
      aria-label={`View ${name}'s forecast notes`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2.5h7l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
        <path d="M10 2.5v3h3" />
        <path d="M4.5 8.5h6M4.5 11h4" />
      </svg>
    </button>
  );
}

/** Opens the forecast entry for this person by firing the plugin's forecast action. */
export function ForecastButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      className="note-btn"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`Enter ${name}'s forecast`}
      aria-label={`Enter ${name}'s forecast`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13.5h12" />
        <path d="M3 10.5l3.5-3.5 2.5 2.5L13.5 5" />
        <path d="M10.5 5h3v3" />
      </svg>
    </button>
  );
}

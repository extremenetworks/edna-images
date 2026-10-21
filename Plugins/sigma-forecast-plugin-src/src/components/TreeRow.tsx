import React from 'react';
import type { TreeNode, MeasureColumn } from '../types';
import { DualValueCell } from './DualValueCell';

// Funnel measures are pure sums of the subtree; show the sum as the primary value
const FUNNEL_KEYS = new Set(['closed', 'open']);

interface Props {
  node: TreeNode;
  depth: number;
  measureColumns: MeasureColumn[];
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  onRowClick?: (name: string) => void;
  onFocus?: (nodeId: string) => void;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TreeRow({ node, depth, measureColumns, isExpanded, onToggle, onRowClick, onFocus, isHovered, onMouseEnter, onMouseLeave }: Props) {
  const hasChildren = node.children.length > 0;
  const isAggregate = !node.isLeaf;
  const indentPx = depth * 24;
  // Placeholder ancestors have no data row (and so no notes) in the source
  const isPlaceholder = node.id.startsWith('placeholder-');

  const submitted = node.submitted !== null
    ? node.submitted
    : Object.values(node.entered).some((v) => v != null && v !== 0);

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

  const closed = node.entered.closed ?? null;
  const closedRolledUp = isAggregate ? (node.rolledUp.closed ?? null) : null;
  const openFunnel = node.entered.open ?? null;
  const openRolledUp = isAggregate ? (node.rolledUp.open ?? null) : null;
  const mlv = node.entered.mlv ?? null;
  const mlvDelta = node.entered.mlvWoW ?? null;
  const lowDelta = node.entered.lowWoW ?? null;
  const highDelta = node.entered.highWoW ?? null;

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
              <span className="name-text">{node.name}</span>
            )}
            <span className="role-text">{roleDisplay}</span>
          </div>
        </div>
      </td>
      <td className={`col-status td-sticky td-sticky-status${onRowClick ? '' : ' frozen-edge'}`}>
        <StatusDot submitted={submitted} />
      </td>
      {onRowClick && (
        <td className="col-notes td-sticky td-sticky-notes frozen-edge">
          {!isPlaceholder && (
            <NoteButton name={node.name} onClick={() => onRowClick(node.name)} />
          )}
        </td>
      )}
      {measureColumns.map((mc) => (
        <td key={mc.key} className="col-measure">
          <DualValueCell
            measureKey={mc.key}
            entered={FUNNEL_KEYS.has(mc.key) && isAggregate
              ? (node.rolledUp[mc.key] ?? null)
              : (node.entered[mc.key] ?? null)}
            rolledUp={isAggregate && !FUNNEL_KEYS.has(mc.key) ? (node.rolledUp[mc.key] ?? null) : null}
            isAggregate={isAggregate}
            isWoW={mc.key === 'mlvWoW'}
            closed={closed}
            closedRolledUp={closedRolledUp}
            openFunnel={openFunnel}
            openRolledUp={openRolledUp}
            mlv={mlv}
            mlvDelta={mlvDelta}
            lowDelta={lowDelta}
            highDelta={highDelta}
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

import React from 'react';
import type { TreeNode, MeasureColumn } from '../types';
import { formatCompact, formatWoW } from '../lib/format';
import { NoteButton, ForecastButton } from './TreeRow';

interface Props {
  node: TreeNode;
  depth: number;
  measureColumns: MeasureColumn[];
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  onFocus?: (nodeId: string) => void;
  onRowClick?: (name: string) => void;
  onForecastClick?: (name: string) => void;
}

export function MobileCard({ node, depth, measureColumns, isExpanded, onToggle, onFocus, onRowClick, onForecastClick }: Props) {
  const hasChildren = node.children.length > 0;
  const isAggregate = !node.isLeaf;
  const indentPx = depth * 16;
  let roleDisplay: string;
  if (node.parsed.orgPath && node.parsed.level && node.parsed.orgPath !== node.parsed.level) {
    const orgParts = node.parsed.orgPath.split('/');
    roleDisplay = `${orgParts[orgParts.length - 1]} · ${node.parsed.level}`;
  } else if (node.parsed.orgPath) {
    roleDisplay = node.parsed.orgPath;
  } else {
    roleDisplay = node.parsed.level || node.role;
  }

  const submitted = node.submitted !== null
    ? node.submitted
    : Object.values(node.entered).some((v) => v != null && v !== 0);

  // Bar data
  const mlv = node.entered.mlv ?? null;
  const closed = isAggregate ? (node.rolledUp.closed ?? node.entered.closed ?? 0) : (node.entered.closed ?? 0);
  const openFunnel = isAggregate ? (node.rolledUp.open ?? node.entered.open ?? 0) : (node.entered.open ?? 0);

  return (
    <div
      className={`mobile-card ${isAggregate ? 'mobile-aggregate' : 'mobile-leaf'}`}
      style={{ marginLeft: `${indentPx}px` }}
    >
      <div className="mobile-card-header" onClick={hasChildren ? () => onToggle(node.id) : undefined}>
        <div className="mobile-card-left">
          {hasChildren && (
            <span className={`mobile-chevron ${isExpanded ? 'expanded' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span className={`avatar avatar-sm depth-color-${Math.min(depth, 4)}`}>
            {node.initials}
          </span>
          <div className="mobile-name-info">
            {onFocus && hasChildren ? (
              <button
                className="name-text name-focus"
                onClick={(e) => { e.stopPropagation(); onFocus(node.id); }}
              >
                {node.name}
              </button>
            ) : (
              <span className="name-text">{node.name}</span>
            )}
            <span className="role-text">{roleDisplay}</span>
          </div>
        </div>
        <div className="status-cell">
          <span className={`status-dot ${submitted ? 'status-submitted' : 'status-missing'}`} />
          {onRowClick && !node.id.startsWith('placeholder-') && (
            <NoteButton name={node.name} onClick={() => onRowClick(node.name)} />
          )}
          {onForecastClick && !node.id.startsWith('placeholder-') && (
            <ForecastButton name={node.name} onClick={() => onForecastClick(node.name)} />
          )}
        </div>
      </div>

      {/* Coverage bar if MLV exists */}
      {mlv != null && mlv > 0 && (
        <div className="mobile-bar-row">
          <MobileCoverageBar closed={closed} open={openFunnel} mlv={mlv} />
        </div>
      )}

      {/* Metrics grid */}
      <div className="mobile-metrics">
        {measureColumns.map((mc) => {
          // Funnel measures (closed/open) show the subtree sum as the primary value
          const isFunnel = mc.key === 'closed' || mc.key === 'open';
          const entered = isFunnel && isAggregate
            ? (node.rolledUp[mc.key] ?? null)
            : (node.entered[mc.key] ?? null);
          const rolledUp = isAggregate && !isFunnel ? (node.rolledUp[mc.key] ?? null) : null;
          if (entered === null && rolledUp === null) return null;

          const isWoW = mc.key === 'mlvWoW';
          const fmt = isWoW ? formatWoW : formatCompact;

          const mlvDelta = node.entered.mlvWoW ?? null;
          const showDelta = mc.key === 'mlv' && mlvDelta !== null && mlvDelta !== 0;

          return (
            <div key={mc.key} className="mobile-metric">
              <span className="mobile-metric-label">{mc.label}</span>
              <div className="mobile-metric-values">
                <span className={`mobile-metric-primary ${isWoW ? getWoWClass(entered) : ''}`}>
                  {fmt(entered)}
                  {showDelta && (
                    <span className={`wow-arrow ${mlvDelta! > 0 ? 'wow-arrow-up' : 'wow-arrow-down'}`}
                      title={formatWoW(mlvDelta)}>
                      {mlvDelta! > 0 ? '▲' : '▼'}
                    </span>
                  )}
                </span>
                {isAggregate && rolledUp !== null && (
                  <span className="mobile-metric-rollup">{fmt(rolledUp)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileCoverageBar({ closed, open, mlv }: { closed: number; open: number; mlv: number }) {
  const closedPct = Math.min(Math.max((closed / mlv) * 100, 0), 100);
  const openPct = Math.min(Math.max((open / mlv) * 100, 0), 100 - closedPct);
  const totalCoverage = Math.round(closedPct + openPct);

  return (
    <div className="mobile-coverage">
      <div className="mobile-coverage-bar">
        {closedPct > 0 && <div className="bar-segment bar-booked" style={{ width: `${closedPct}%` }} />}
        {openPct > 0 && <div className="bar-segment bar-open" style={{ width: `${openPct}%` }} />}
      </div>
      <div className="mobile-coverage-labels">
        <span className="coverage-label"><span className="dot-booked" /> {Math.round(closedPct)}% booked</span>
        <span className="coverage-label"><span className="dot-open" /> {Math.round(openPct)}% open</span>
        <span className="coverage-label coverage-total">{totalCoverage}% coverage</span>
      </div>
    </div>
  );
}

function getWoWClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? 'wow-positive' : 'wow-negative';
}

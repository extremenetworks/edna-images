import React from 'react';
import { formatCompact, formatWoW, coverageParts } from '../lib/format';

/** Booked + commit (+ most likely) against a forecast value, drawn as a stacked coverage bar. */
export interface CoverageData {
  closed: number;
  open: number;
  total: number;
  /** Most Likely amount, the bar's third segment (0 when not used) */
  likely?: number;
  /** Name of the forecast value in the tooltip, e.g. MLV or M1 */
  label: string;
}

interface Props {
  entered: number | null;
  rolledUp: number | null;
  isAggregate: boolean;
  isWoW?: boolean;
  /** Change since the previous week, shown as an arrow */
  delta: number | null;
  coverage: CoverageData | null;
}

export function DualValueCell({ entered, rolledUp, isAggregate, isWoW, delta, coverage }: Props) {
  if (entered === null && rolledUp === null) {
    return <span className="value-dash">-</span>;
  }

  const fmt = isWoW ? formatWoW : formatCompact;
  const showDelta = delta !== null && delta !== 0;
  const showBar = coverage !== null && coverage.total > 0;

  if (!isAggregate || rolledUp === null) {
    return (
      <div className="value-single">
        <span className={`value-primary ${isWoW ? getWoWClass(entered) : ''}`}>
          {fmt(entered)}
          {showDelta && <WoWBadge delta={delta!} />}
        </span>
        {showBar && <CoverageBar closed={coverage!.closed} open={coverage!.open} likely={coverage!.likely ?? 0} mlv={coverage!.total} label={coverage!.label} />}
      </div>
    );
  }

  return (
    <div className="value-dual">
      <span className={`value-primary ${isWoW ? getWoWClass(entered) : ''}`}>
        {fmt(entered)}
        {showDelta && <WoWBadge delta={delta!} />}
      </span>
      <span className="value-rollup">
        {fmt(rolledUp)}
      </span>
      {showBar && <CoverageBar closed={coverage!.closed} open={coverage!.open} likely={coverage!.likely ?? 0} mlv={coverage!.total} label={coverage!.label} />}
    </div>
  );
}

function WoWBadge({ delta }: { delta: number }) {
  const isUp = delta > 0;
  const arrow = isUp ? '▲' : '▼';
  const cls = isUp ? 'wow-arrow-up' : 'wow-arrow-down';

  return (
    <span className={`wow-arrow ${cls}`} title={formatWoW(delta)}>
      {arrow}
    </span>
  );
}

function CoverageBar({ closed, open, likely, mlv, label }: { closed: number; open: number; likely: number; mlv: number; label: string }) {
  if (mlv <= 0) return null;

  const { closedPct, openPct, likelyPct, totalPct, closedWidth, openWidth, likelyWidth } = coverageParts(closed, open, mlv, likely);
  const totalCoverage = Math.round(totalPct);

  const tooltip = `Booked: ${formatCompact(closed)} (${Math.round(closedPct)}%)\nCommit: ${formatCompact(open)} (${Math.round(openPct)}%)${likely > 0 ? `\nMost Likely: ${formatCompact(likely)} (${Math.round(likelyPct)}%)` : ''}\n${label}: ${formatCompact(mlv)}\nCoverage: ${totalCoverage}%`;

  return (
    <div className="stacked-bar-container" title={tooltip}>
      <div className="stacked-bar">
        {closedWidth > 0 && (
          <div className="bar-segment bar-booked" style={{ width: `${closedWidth}%` }} />
        )}
        {openWidth > 0 && (
          <div className="bar-segment bar-open" style={{ width: `${openWidth}%` }} />
        )}
        {likelyWidth > 0 && (
          <div className="bar-segment bar-likely" style={{ width: `${likelyWidth}%` }} />
        )}
      </div>
      <span className="progress-label">{totalCoverage}%</span>
    </div>
  );
}

function getWoWClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? 'wow-positive' : 'wow-negative';
}

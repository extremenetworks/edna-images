import React from 'react';
import { formatCompact, formatWoW } from '../lib/format';

interface Props {
  measureKey: string;
  entered: number | null;
  rolledUp: number | null;
  isAggregate: boolean;
  isWoW?: boolean;
  closed: number | null;
  closedRolledUp: number | null;
  openFunnel: number | null;
  openRolledUp: number | null;
  mlv: number | null;
  mlvDelta: number | null;
  lowDelta: number | null;
  highDelta: number | null;
}

export function DualValueCell({ measureKey, entered, rolledUp, isAggregate, isWoW, closed, closedRolledUp, openFunnel, openRolledUp, mlv, mlvDelta, lowDelta, highDelta }: Props) {
  if (entered === null && rolledUp === null) {
    return <span className="value-dash">-</span>;
  }

  const fmt = isWoW ? formatWoW : formatCompact;
  const showBar = measureKey === 'mlv' && mlv != null && mlv > 0;

  // Determine delta for this measure
  let delta: number | null = null;
  if (measureKey === 'mlv') delta = mlvDelta;
  else if (measureKey === 'low') delta = lowDelta;
  else if (measureKey === 'high') delta = highDelta;
  const showDelta = delta !== null && delta !== 0;

  const barClosed = isAggregate ? (closedRolledUp ?? closed ?? 0) : (closed ?? 0);
  const barOpen = isAggregate ? (openRolledUp ?? openFunnel ?? 0) : (openFunnel ?? 0);
  const barTotal = isAggregate ? (entered ?? mlv!) : mlv!;

  if (!isAggregate || rolledUp === null) {
    return (
      <div className="value-single">
        <span className={`value-primary ${isWoW ? getWoWClass(entered) : ''}`}>
          {fmt(entered)}
          {showDelta && <WoWBadge delta={delta!} />}
        </span>
        {showBar && <CoverageBar closed={barClosed} open={barOpen} mlv={barTotal} />}
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
      {showBar && <CoverageBar closed={barClosed} open={barOpen} mlv={barTotal} />}
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

function CoverageBar({ closed, open, mlv }: { closed: number; open: number; mlv: number }) {
  if (mlv <= 0) return null;

  const closedPct = Math.min(Math.max((closed / mlv) * 100, 0), 100);
  const openPct = Math.min(Math.max((open / mlv) * 100, 0), 100 - closedPct);
  const totalCoverage = Math.round(closedPct + openPct);

  const tooltip = `Booked: ${formatCompact(closed)} (${Math.round(closedPct)}%)\nOpen: ${formatCompact(open)} (${Math.round(openPct)}%)\nMLV: ${formatCompact(mlv)}\nCoverage: ${totalCoverage}%`;

  return (
    <div className="stacked-bar-container" title={tooltip}>
      <div className="stacked-bar">
        {closedPct > 0 && (
          <div className="bar-segment bar-booked" style={{ width: `${closedPct}%` }} />
        )}
        {openPct > 0 && (
          <div className="bar-segment bar-open" style={{ width: `${openPct}%` }} />
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dependency-free SVG charts, themed via CSS variables.
 */

import React, { useState } from 'react';

const PALETTE = [
  'var(--accent)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--text-secondary)',
];

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

function formatValue(v: number, money?: boolean) {
  if (money) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
    return `$${v.toLocaleString()}`;
  }
  return v.toLocaleString();
}

/* ────────────────────────── Horizontal BarChart ────────────────────────── */

export function BarChart({ data, money = false }: { data: ChartDatum[]; money?: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2.5" role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-theme-secondary font-sans truncate pr-2">{d.label}</span>
            <span className="text-2xs font-semibold text-theme-primary tnum">{formatValue(d.value, money)}</span>
          </div>
          <div className="h-1.5 bg-theme-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color || PALETTE[i % PALETTE.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────── DonutChart ────────────────────────── */

export function DonutChart({
  data,
  money = false,
  centerLabel,
}: {
  data: ChartDatum[];
  money?: boolean;
  centerLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 60;
  const STROKE = 18;
  const C = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const seg = { ...d, frac, offset: cumulative, i };
    cumulative += frac;
    return seg;
  });

  const active = hovered !== null ? segments[hovered] : null;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img" aria-label="Donut chart">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--bg-inset)" strokeWidth={STROKE} />
        {segments.map(s => (
          <circle
            key={s.label}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={s.color || PALETTE[s.i % PALETTE.length]}
            strokeWidth={hovered === s.i ? STROKE + 3 : STROKE}
            strokeDasharray={`${Math.max(s.frac * C - 2, 0)} ${C}`}
            strokeDashoffset={-s.offset * C}
            transform="rotate(-90 80 80)"
            strokeLinecap="butt"
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHovered(s.i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="font-sans tnum"
          style={{ fill: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}
        >
          {active ? formatValue(active.value, money) : formatValue(total, money)}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="font-sans"
          style={{ fill: 'var(--text-secondary)', fontSize: 9 }}
        >
          {active ? active.label.slice(0, 18) : centerLabel || 'Total'}
        </text>
      </svg>

      <div className="space-y-1.5 min-w-0">
        {segments.map(s => (
          <div
            key={s.label}
            className={`flex items-center gap-2 cursor-pointer rounded px-1 -mx-1 transition-colors ${hovered === s.i ? 'bg-theme-hover' : ''}`}
            onMouseEnter={() => setHovered(s.i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: s.color || PALETTE[s.i % PALETTE.length] }}
            />
            <span className="text-2xs text-theme-secondary truncate">{s.label}</span>
            <span className="text-2xs font-medium text-theme-primary ml-auto tnum">
              {total > 0 ? Math.round(s.frac * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── TrendLine (area sparkline with axis) ────────────────────────── */

export function TrendLine({
  points,
  labels,
  money = false,
  height = 140,
}: {
  points: number[];
  labels?: string[];
  money?: boolean;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 400;
  const H = height;
  const PAD = 8;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const xy = points.map((p, i) => [
    PAD + (i * (W - PAD * 2)) / Math.max(points.length - 1, 1),
    H - PAD - ((p - min) / range) * (H - PAD * 2 - 14),
  ]);

  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0]},${H - PAD} L${xy[0][0]},${H - PAD} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Trend chart"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + f * (H - PAD * 2)}
            y2={PAD + f * (H - PAD * 2)}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray="3 4"
          />
        ))}

        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {xy.map(([x, y], i) => (
          <g key={i}>
            {/* generous invisible hit area */}
            <rect
              x={x - (W / points.length) / 2}
              y={0}
              width={W / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
            {hovered === i && (
              <>
                <line x1={x} x2={x} y1={PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
                <circle cx={x} cy={y} r="4" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="2" />
                <text
                  x={Math.min(Math.max(x, 30), W - 30)}
                  y={Math.max(y - 12, 12)}
                  textAnchor="middle"
                  className="tnum"
                  style={{ fill: 'var(--text-primary)', fontSize: 10, fontWeight: 600 }}
                >
                  {formatValue(points[i], money)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>

      {labels && (
        <div className="flex justify-between px-1 mt-1">
          {labels.map((l, i) => (
            <span
              key={i}
              className={`text-[9px] font-sans ${hovered === i ? 'text-theme-primary font-semibold' : 'text-theme-secondary'}`}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── FunnelChart (pipeline stages) ────────────────────────── */

export function FunnelChart({ data, money = false }: { data: ChartDatum[]; money?: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-1.5" role="img" aria-label="Funnel chart">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-2xs text-theme-secondary font-sans w-28 truncate text-right shrink-0">{d.label}</span>
            <div className="flex-1 h-6 bg-theme-inset/60 rounded-md overflow-hidden flex items-center">
              <div
                className="h-full rounded-md flex items-center justify-end px-2 min-w-fit transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: d.color || PALETTE[i % PALETTE.length],
                  opacity: 0.9,
                }}
              >
                <span className="text-[9px] font-bold text-white tnum whitespace-nowrap">
                  {formatValue(d.value, money)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

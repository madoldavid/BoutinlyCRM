import React, { useState } from 'react';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Printer,
  Star,
  ExternalLink,
} from 'lucide-react';
import { Button, Badge, KpiCard, Skeleton } from './index';
import ActivityTimeline from './ActivityTimeline';
import type { Activity, Contact, User, Deal, Account, Task } from '../../types';

/* ──────── Detail sections ──────── */

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

function FieldRow({ label, value, className = '' }: FieldRowProps) {
  return (
    <div className={`flex items-start py-2.5 border-b border-theme-border last:border-0 ${className}`}>
      <span className="w-[140px] shrink-0 text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans pt-0.5">{label}</span>
      <span className="text-xs text-theme-primary font-sans min-w-0">{value || <span className="text-theme-secondary/40">—</span>}</span>
    </div>
  );
}

interface HighlightsPanelProps {
  title: string;
  children: React.ReactNode;
}

function HighlightsPanel({ title, children }: HighlightsPanelProps) {
  return (
    <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4">
      <h4 className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* ──────── Tabs ──────── */

interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

interface DetailTabsProps {
  tabs: TabItem[];
}

function DetailTabs({ tabs }: DetailTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  if (tabs.length === 0) return null;

  return (
    <div>
      <div className="flex border-b border-theme-border" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`relative px-4 py-2.5 text-xs font-medium font-sans cursor-pointer transition-colors ${
              active === tab.id
                ? 'text-theme-accent'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-sans ${
                active === tab.id ? 'bg-theme-accent-soft text-theme-accent' : 'bg-theme-inset text-theme-secondary'
              }`}>{tab.count}</span>
            )}
            {active === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent rounded-full" />
            )}
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        {tabs.find(t => t.id === active)?.content}
      </div>
    </div>
  );
}

/* ──────── Related records ──────── */

interface RelatedListProps {
  items: { id: string; primary: string; secondary?: string; status?: string; statusTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; onClick?: () => void }[];
  emptyMessage: string;
  columns: { label: string; width: string }[];
}

function RelatedList({ items, emptyMessage, columns }: RelatedListProps) {
  if (items.length === 0) {
    return <p className="text-xs text-theme-secondary py-4 text-center">{emptyMessage}</p>;
  }
  return (
    <div className="divide-y divide-theme-border border border-theme-border rounded-[8px] overflow-hidden">
      {/* Header */}
      <div className="flex bg-theme-inset px-3 py-2">
        {columns.map((c, i) => (
          <span key={i} className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans" style={{ width: c.width }}>{c.label}</span>
        ))}
      </div>
      {/* Rows */}
      {items.map(item => (
        <div
          key={item.id}
          className="flex items-center px-3 py-2.5 hover:bg-theme-hover cursor-pointer transition-colors text-xs font-sans"
          onClick={item.onClick}
        >
          <span className="text-theme-primary font-medium truncate" style={{ width: columns[0]?.width }}>{item.primary}</span>
          {item.secondary && <span className="text-theme-secondary truncate" style={{ width: columns[1]?.width }}>{item.secondary}</span>}
          {item.status && (
            <span className="flex-1 flex justify-end">
              <Badge tone={item.statusTone || 'neutral'}>{item.status}</Badge>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────── Main RecordDetailPage ──────── */

export interface RecordDetailPageProps {
  loading?: boolean;
  /* Header */
  title: string;
  subtitle?: string;
  status?: { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' };
  onBack?: () => void;
  actions?: React.ReactNode;

  /* Main content (left column) */
  children: React.ReactNode;

  /* Right sidebar */
  highlightsPanel?: React.ReactNode;
  highlightsTitle?: string;

  /* Activity timeline */
  activities?: Activity[];
  users?: User[];
  timelineTitle?: string;

  /* Tabs below main content */
  tabs?: TabItem[];

  /* Path / stage indicator at top */
  pathIndicator?: React.ReactNode;

  className?: string;
}

export default function RecordDetailPage({
  loading = false,
  title,
  subtitle,
  status,
  onBack,
  actions,
  children,
  highlightsPanel,
  highlightsTitle = 'Highlights',
  activities,
  users = [],
  timelineTitle = 'Activity Timeline',
  tabs,
  pathIndicator,
  className = '',
}: RecordDetailPageProps) {
  return (
    <div className={`flex-1 flex flex-col overflow-hidden bg-theme-base ${className}`}>
      {/* Path indicator (e.g. Sales path / stage bar) */}
      {pathIndicator && (
        <div className="shrink-0">{pathIndicator}</div>
      )}

      {/* Record Header */}
      <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-theme-primary font-display truncate">{title}</h1>
            {subtitle && <p className="text-xs text-theme-secondary mt-0.5">{subtitle}</p>}
          </div>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Body — two columns */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
            {/* Left column: main detail */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Details section */}
              <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Details</h3>
                {children}
              </div>

              {/* Tabs for related records */}
              {tabs && tabs.length > 0 && (
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <DetailTabs tabs={tabs} />
                </div>
              )}
            </div>

            {/* Right column: highlights + timeline */}
            <div className="w-full lg:w-[340px] shrink-0 space-y-4 lg:space-y-6 mt-4 lg:mt-0">
              {highlightsPanel && (
                <HighlightsPanel title={highlightsTitle}>
                  {highlightsPanel}
                </HighlightsPanel>
              )}

              {activities !== undefined && (
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h4 className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-3">{timelineTitle}</h4>
                  <div className="max-h-[500px] overflow-y-auto pr-1 -mr-1">
                    <ActivityTimeline
                      activities={activities}
                      users={users}
                      emptyMessage="No activities recorded yet."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { RelatedList, FieldRow, HighlightsPanel, DetailTabs };

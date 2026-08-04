import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  X,
} from 'lucide-react';

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'list' | 'table';
  title: string;
  span: 'sm' | 'md' | 'lg' | 'full';
  content: React.ReactNode;
  actions?: React.ReactNode;
  onRefresh?: () => void;
}

interface DashboardWidgetGridProps {
  widgets: DashboardWidget[];
  onLayoutChange?: (order: string[]) => void;
  className?: string;
}

const spanCols: Record<string, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 lg:col-span-1',
  lg: 'col-span-1 md:col-span-2',
  full: 'col-span-1 md:col-span-2 lg:col-span-4',
};

function WidgetCard({
  widget,
  isExpanded,
  onToggleExpand,
  onEdit,
}: {
  widget: DashboardWidget;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className={`bg-theme-card border border-theme-border rounded-[10px] shadow-card overflow-hidden flex flex-col transition-all ${
        isExpanded ? 'ring-2 ring-theme-accent/30' : ''
      }`}
      data-widget-id={widget.id}
    >
      {/* Widget header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border bg-theme-inset/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-theme-secondary/40 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
            <GripHorizontal className="w-3.5 h-3.5" />
          </span>
          <h4 className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans truncate">{widget.title}</h4>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {widget.onRefresh && (
            <button
              onClick={widget.onRefresh}
              className="p-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
              aria-label={`Refresh ${widget.title}`}
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          {widget.actions}
          <button
            onClick={onToggleExpand}
            className="p-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {/* Widget content */}
      <div className="flex-1 overflow-auto">
        {widget.content}
      </div>
    </div>
  );
}

export default function DashboardWidgetGrid({ widgets, onLayoutChange, className = '' }: DashboardWidgetGridProps) {
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedWidget(prev => (prev === id ? null : id));
  }, []);

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-theme-card border border-theme-border border-dashed rounded-[10px]">
        <div className="w-12 h-12 rounded-full bg-theme-inset flex items-center justify-center mb-3 text-theme-secondary/40">
          <GripHorizontal className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-theme-primary font-sans">No widgets configured</h4>
        <p className="text-xs text-theme-secondary mt-1">Add widgets to build your dashboard.</p>
      </div>
    );
  }

  const regularWidgets = widgets.filter(w => expandedWidget !== w.id);
  const expanded = expandedWidget ? widgets.find(w => w.id === expandedWidget) : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Expanded widget takes full width */}
      {expanded && (
        <div className="grid grid-cols-1">
          <WidgetCard
            widget={expanded}
            isExpanded={true}
            onToggleExpand={() => toggleExpand(expanded.id)}
          />
        </div>
      )}

      {/* Regular widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {regularWidgets.map(widget => (
          <div key={widget.id} className={spanCols[widget.span] || 'col-span-1'}>
            <WidgetCard
              widget={widget}
              isExpanded={false}
              onToggleExpand={() => toggleExpand(widget.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

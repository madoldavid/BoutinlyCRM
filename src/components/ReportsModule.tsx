/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useCRM } from '../store';
import { UserRole, Deal, Task } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ListTodo, 
  BarChart3, 
  PieChart, 
  GitPullRequest, 
  FileDown, 
  Sparkles,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { FunnelChart, DonutChart, TrendLine } from './ui/charts';
import DashboardWidgetGrid, { type DashboardWidget } from './ui/DashboardWidgetGrid';
import { buildNextBestActions, findDuplicateContacts, type InsightContext } from '../ai/insights';
import { dispatchSelectEntity, dispatchDrillDown } from './GlobalShortcuts';
import SetupChecklist from './SetupChecklist';

export default function ReportsModule() {
  const {
    currentUser,
    getScopedDeals,
    getScopedTasks,
    getScopedActivities,
    accounts,
    contacts,
    users,
    stages,
    activePipelineId,
    setActiveModule
  } = useCRM();

  const [activeSubTab, setActiveSubTab] = useState<'dash' | 'health' | 'winloss' | 'builder'>('dash');

  // Custom Report Builder States
  const [reportEntity, setReportEntity] = useState<'contact' | 'account' | 'deal' | 'task'>('deal');
  const [reportGrouping, setReportGrouping] = useState<string>('owner_id');
  const [reportMetric, setReportMetric] = useState<'count' | 'sum_value'>('sum_value');
  const [reportResult, setReportResult] = useState<any[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);

  const scopedDeals = getScopedDeals();
  const scopedTasks = getScopedTasks();
  const scopedActivities = getScopedActivities();

  // ─── Boutinly Intelligence: next best actions + data quality ───
  const insightContext = useMemo<InsightContext>(() => ({
    deals: scopedDeals,
    stages,
    contacts,
    accounts,
    tasks: scopedTasks,
    activities: scopedActivities,
    users,
    currentUserId: currentUser?.id ?? '',
    currentUserRole: currentUser?.role ?? UserRole.VIEWER,
  }), [scopedDeals, stages, contacts, accounts, scopedTasks, scopedActivities, users, currentUser]);

  const nextBestActions = useMemo(() => buildNextBestActions(insightContext, 6), [insightContext]);
  const duplicateGroups = useMemo(() => findDuplicateContacts(contacts), [contacts]);
  const dataQuality = useMemo(() => {
    const incomplete = contacts.filter(c => !c.phone || !c.title || !c.email).length;
    const unassigned = contacts.filter(c => !users.some(u => u.id === c.owner_id)).length;
    return { incomplete, unassigned, duplicates: duplicateGroups.reduce((n, g) => n + g.contacts.length, 0) };
  }, [contacts, users, duplicateGroups]);

  // Metrics Calculations
  const wonDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'won';
  });

  const lostDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'lost';
  });

  const openDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'open';
  });

  const totalClosedDealsCount = wonDeals.length + lostDeals.length;
  const winRate = totalClosedDealsCount > 0 ? (wonDeals.length / totalClosedDealsCount) * 100 : 0;

  const totalOpenValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);

  // Rep Quota Attainment
  const personalQuota = currentUser?.custom_fields?.quota
    ? Number(currentUser.custom_fields.quota)
    : 1000000;
  const repQuotaAttainment = personalQuota > 0 ? (totalWonValue / personalQuota) * 100 : 0;

  // Render personal or manager views based on role
  const isManagerOrAdmin = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(currentUser.role);

  // Won revenue by month (trailing 6 months) for trend chart
  const trendData = (() => {
    const now = new Date();
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const value = wonDeals
        .filter(deal => {
          const t = new Date(deal.won_at || deal.close_date).getTime();
          return t >= d.getTime() && t < next.getTime();
        })
        .reduce((sum, deal) => sum + deal.value, 0);
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value });
    }
    return months;
  })();

  // Open pipeline value by stage for funnel chart
  const activeStagesForChart = stages.filter(s => s.pipeline_id === activePipelineId);
  const funnelData = activeStagesForChart.map(stg => ({
    label: stg.name,
    value: scopedDeals.filter(d => d.stage_id === stg.id).reduce((sum, d) => sum + d.value, 0),
    color: stg.type === 'won' ? 'var(--success)' : stg.type === 'lost' ? 'var(--text-secondary)' : undefined,
  }));

  // CSV export helper
  const handleExportCsv = () => {
    if (reportResult.length === 0) return;
    const headers = ['Group', 'Volume'];
    if (reportEntity === 'deal' && reportMetric === 'sum_value') headers.push('Total Value');
    const rows = reportResult.map(row => {
      const vals = [row.groupName, String(row.count)];
      if (reportEntity === 'deal' && reportMetric === 'sum_value') vals.push(String(row.value));
      return vals.map(v => `"${v}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportEntity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate Custom Report Trigger
  const handleGenerateReport = () => {
    setReportGenerated(true);
    let results: any[] = [];
    
    if (reportEntity === 'deal') {
      // Group deals
      const groups: Record<string, Deal[]> = {};
      scopedDeals.forEach(d => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === d.owner_id)?.name || 'Unknown Rep';
        } else if (reportGrouping === 'stage_id') {
          key = stages.find(s => s.id === d.stage_id)?.name || 'Unknown Stage';
        } else if (reportGrouping === 'account_id') {
          key = accounts.find(a => a.id === d.account_id)?.name || 'Unknown Account';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      });

      results = Object.entries(groups).map(([groupName, items]) => {
        const count = items.length;
        const totalVal = items.reduce((sum, i) => sum + i.value, 0);
        return {
          groupName,
          count,
          value: totalVal
        };
      });
    } else if (reportEntity === 'contact') {
      // Group contacts
      const groups: Record<string, any[]> = {};
      contacts.forEach(c => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === c.owner_id)?.name || 'Unknown Rep';
        } else if (reportGrouping === 'account_id') {
          key = accounts.find(a => a.id === c.account_id)?.name || 'Unassigned Account';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });

      results = Object.entries(groups).map(([groupName, items]) => ({
        groupName,
        count: items.length,
        value: 0
      }));
    } else if (reportEntity === 'task') {
      // Group tasks
      const groups: Record<string, Task[]> = {};
      scopedTasks.forEach(t => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === t.assigned_to_id)?.name || 'Unknown User';
        } else if (reportGrouping === 'type') {
          key = t.type.toUpperCase();
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      results = Object.entries(groups).map(([groupName, items]) => ({
        groupName,
        count: items.length,
        value: 0
      }));
    }

    setReportResult(results);
  };

  const dashboardWidgets = useMemo<DashboardWidget[]>(() => [
    {
      id: 'kpi-open-value',
      type: 'kpi',
      title: 'Open Pipeline Value',
      span: 'sm',
      content: (
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xs text-theme-secondary uppercase tracking-wider font-sans">Open Pipeline</span>
            <DollarSign className="w-4 h-4 text-theme-accent/60" />
          </div>
          <p className="text-xl font-bold text-theme-primary tnum" data-metric>${totalOpenValue.toLocaleString()}</p>
          <p className="text-2xs text-theme-secondary mt-1 font-sans">{openDeals.length} active deals</p>
        </div>
      ),
    },
    {
      id: 'kpi-won-revenue',
      type: 'kpi',
      title: 'Closed Won Revenue',
      span: 'sm',
      content: (
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xs text-theme-secondary uppercase tracking-wider font-sans">Closed Won</span>
            <TrendingUp className="w-4 h-4 text-success/60" />
          </div>
          <p className="text-xl font-bold text-theme-primary tnum" data-metric>${totalWonValue.toLocaleString()}</p>
          <p className="text-2xs text-theme-secondary mt-1 font-sans">${personalQuota.toLocaleString()} quota</p>
        </div>
      ),
    },
    {
      id: 'kpi-winrate',
      type: 'kpi',
      title: 'Win Rate',
      span: 'sm',
      content: (
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xs text-theme-secondary uppercase tracking-wider font-sans">Win Rate</span>
            <Percent className="w-4 h-4 text-info/60" />
          </div>
          <p className="text-xl font-bold text-theme-primary tnum" data-metric>{winRate.toFixed(1)}%</p>
          <p className="text-2xs text-theme-secondary mt-1 font-sans">{wonDeals.length} won / {lostDeals.length} lost</p>
        </div>
      ),
    },
    {
      id: 'kpi-activities',
      type: 'kpi',
      title: 'Activities',
      span: 'sm',
      content: (
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xs text-theme-secondary uppercase tracking-wider font-sans">Activities</span>
            <ListTodo className="w-4 h-4 text-warning/60" />
          </div>
          <p className="text-xl font-bold text-theme-primary tnum" data-metric>{scopedActivities.length}</p>
          <p className="text-2xs text-theme-secondary mt-1 font-sans">Calls, notes, emails</p>
        </div>
      ),
    },
    {
      id: 'chart-funnel',
      type: 'chart',
      title: 'Pipeline Funnel',
      span: 'md',
      content: (
        <div className="p-4">
          <FunnelChart
            data={activeStagesForChart.map(stg => ({
              label: stg.name,
              value: scopedDeals.filter(d => d.stage_id === stg.id).reduce((sum, d) => sum + d.value, 0),
            }))}
            onDrillDown={(label) => dispatchDrillDown({ module: 'deals', filterKey: 'stage', filterValue: label })}
          />
        </div>
      ),
    },
    {
      id: 'chart-trend',
      type: 'chart',
      title: 'Revenue Trend',
      span: 'md',
      content: (
        <div className="p-4">
          <TrendLine points={trendData.map(t => t.value)} labels={trendData.map(t => t.label)} money height={160} />
        </div>
      ),
    },
    {
      id: 'ai-actions',
      type: 'list',
      title: 'AI — Next Best Actions',
      span: 'lg',
      content: (
        <div className="p-4">
          {nextBestActions.length === 0 ? (
            <div className="py-6 text-center">
              <ShieldCheck className="w-8 h-8 mx-auto text-success/50 mb-2" />
              <p className="text-xs text-theme-secondary font-sans">All caught up — no urgent actions detected.</p>
            </div>
          ) : (
            <div className="divide-y divide-theme-border rounded-lg border border-theme-border overflow-hidden max-h-[260px] overflow-y-auto">
              {nextBestActions.map(action => {
                const priorityTone = action.priority === 'high'
                  ? 'bg-danger-soft text-danger'
                  : action.priority === 'medium' ? 'bg-warning-soft text-warning' : 'bg-theme-inset text-theme-secondary';
                return (
                  <div key={action.id} className="flex items-start gap-3 p-3 hover:bg-theme-hover/50 cursor-pointer transition-colors" onClick={() => {
                    if (action.entityId) dispatchSelectEntity({ module: action.module, entityId: action.entityId });
                  }}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${priorityTone}`}>{action.priority.toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-theme-primary">{action.title}</p>
                      <p className="text-2xs text-theme-secondary mt-0.5">{action.reason}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-theme-secondary/40 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'chart-donut',
      type: 'chart',
      title: 'Pipeline Distribution',
      span: 'md',
      content: (
        <div className="p-4">
          <DonutChart
            data={activeStagesForChart.map(stg => ({
              label: stg.name,
              value: scopedDeals.filter(d => d.stage_id === stg.id).length,
              color: stg.type === 'won' ? 'var(--success)' : stg.type === 'lost' ? 'var(--text-secondary)' : undefined,
            }))}
            onDrillDown={(label) => dispatchDrillDown({ module: 'deals', filterKey: 'stage', filterValue: label })}
          />
        </div>
      ),
    },
    {
      id: 'data-quality',
      type: 'list',
      title: 'Data Quality',
      span: 'sm',
      content: (
        <div className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-theme-secondary font-sans">Incomplete Contacts</span>
              <span className={`text-xs font-bold ${dataQuality.incomplete > 0 ? 'text-warning' : 'text-success'}`}>{dataQuality.incomplete}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-theme-secondary font-sans">Unassigned Contacts</span>
              <span className={`text-xs font-bold ${dataQuality.unassigned > 0 ? 'text-warning' : 'text-success'}`}>{dataQuality.unassigned}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-theme-secondary font-sans">Duplicate Contacts</span>
              <span className={`text-xs font-bold ${dataQuality.duplicates > 0 ? 'text-danger' : 'text-success'}`}>{dataQuality.duplicates}</span>
            </div>
            {duplicateGroups.length > 0 && (
              <div className="pt-2 border-t border-theme-border">
                <p className="text-2xs text-theme-secondary mb-2">{duplicateGroups.length} duplicate group(s) detected</p>
                {duplicateGroups.slice(0, 3).map((g, i) => (
                  <div key={i} className="text-2xs text-warning mb-1">
                    {g.contacts.map(c => `${c.first_name} ${c.last_name}`).join(' ≈ ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ], [totalOpenValue, openDeals.length, totalWonValue, personalQuota, winRate, wonDeals.length, lostDeals.length, scopedActivities.length, activeStagesForChart, scopedDeals, trendData, nextBestActions, dataQuality, duplicateGroups]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base text-theme-primary">
      {/* Module Title Section */}
      <header className="bg-theme-card border-b border-theme-border px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            <TrendingUp className="w-5.5 h-5.5 text-theme-accent" />
            Reports & Analytics
          </h2>
          <p className="text-xs text-theme-secondary mt-0.5">Real-time revenue forecast, team targets, and performance pipeline snapshots.</p>
        </div>
        
        {/* Sub Navigation tabs */}
        <div className="flex items-center gap-1.5 bg-theme-base p-1 rounded-lg border border-theme-border text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('dash')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'dash' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            {isManagerOrAdmin ? 'Team Dashboard' : 'My Performance'}
          </button>
          <button
            onClick={() => setActiveSubTab('health')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'health' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Pipeline Health
          </button>
          <button
            onClick={() => setActiveSubTab('winloss')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'winloss' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Win/Loss Analysis
          </button>
          <button
            onClick={() => setActiveSubTab('builder')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'builder' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Custom Report Builder
          </button>
        </div>
      </header>

      {/* Main content scroll pane */}
      <div className="flex-1 overflow-y-auto p-6 font-sans">
        
        {/* SUB TAB: DASHBOARDS */}
        {activeSubTab === 'dash' && (
          <div className="space-y-6">
            <SetupChecklist />
            {accounts.length === 0 && (
              <div className="bg-theme-card border border-theme-border border-dashed rounded-[10px] p-4 flex items-center justify-between gap-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center shrink-0">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-theme-primary">No company account yet</p>
                    <p className="text-2xs text-theme-secondary">Create your organization as an account to associate contacts and deals.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveModule('contacts'); setTimeout(() => window.dispatchEvent(new Event('boutinly:new-record')), 100); }}
                  className="shrink-0 text-xs font-medium text-white bg-theme-accent hover:opacity-90 rounded-md px-3 py-1.5 cursor-pointer transition-opacity shadow-card"
                >
                  Create Account
                </button>
              </div>
            )}
            <DashboardWidgetGrid widgets={dashboardWidgets} />
          </div>
        )}

        {/* SUB TAB: PIPELINE HEALTH */}
        {activeSubTab === 'health' && (
          <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border space-y-6">
            <div>
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <GitPullRequest className="w-5 h-5 text-theme-accent" />
                Pipeline Conversion Funnel & Health Diagnostics
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Visualizing conversion degradation at each pipeline stage. Ideal for identifying sales friction bottlenecks.
              </p>
            </div>

            {/* Custom Funnel Visualizer (SVG Horizontal bars of decreasing width) */}
            <div className="flex flex-col items-center justify-center py-6 space-y-4 max-w-xl mx-auto">
              {stages.filter(s => s.pipeline_id === activePipelineId && s.type === 'open').length === 0 ? (
                <div className="text-center py-8 text-xs text-theme-secondary/70 font-sans">
                  <GitPullRequest className="w-10 h-10 mx-auto mb-2 text-theme-secondary/30" />
                  <p className="font-semibold text-theme-secondary">No pipeline stages available</p>
                  <p className="mt-1">Configure your pipeline stages to visualize the deal funnel.</p>
                </div>
              ) : (
                stages.filter(s => s.pipeline_id === activePipelineId && s.type === 'open').map((stg, index) => {
                const dealsInStgCount = scopedDeals.filter(d => d.stage_id === stg.id).length;
                const widthPercent = 100 - (index * 15); // Stagger funnel layout
                
                return (
                  <div key={stg.id} className="w-full flex items-center gap-4">
                    <span className="w-32 text-right text-xs font-semibold text-theme-secondary">{stg.name}</span>
                    <div className="flex-1">
                      <div 
                        className="bg-theme-accent hover:opacity-90 text-white text-xs font-bold py-2 px-3 rounded shadow-xs flex justify-between items-center transition-all"
                        style={{ width: `${widthPercent}%` }}
                      >
                        <span>{dealsInStgCount} Deals</span>
                        <span>{stg.probability}% Prob</span>
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>

            <div className="border-t border-theme-border pt-5">
              <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Health Indicators</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-theme-secondary leading-normal">
                {(() => {
                  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                  const stagnantDeals = openDeals.filter(d => {
                    const entered = new Date(d.stage_entered_at);
                    return entered < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                  });
                  const recentlyWon = wonDeals.filter(d => {
                    const wonAt = d.won_at ? new Date(d.won_at) : null;
                    return wonAt && wonAt > thirtyDaysAgo;
                  });
                  const recentlyLost = lostDeals.filter(d => {
                    const lostAt = d.lost_at ? new Date(d.lost_at) : null;
                    return lostAt && lostAt > thirtyDaysAgo;
                  });

                  return (
                    <>
                      {stagnantDeals.length > 0 && (
                        <div className="p-4 bg-theme-accent/5 rounded-lg border border-theme-accent/15 flex gap-3">
                          <div className="text-theme-accent shrink-0 text-base">⚠️</div>
                          <div>
                            <span className="font-semibold block text-theme-primary">Stagnant Deal{stagnantDeals.length > 1 ? 's' : ''} Detected</span>
                            {stagnantDeals.length} deal{stagnantDeals.length > 1 ? 's' : ''} stuck in current stage for over 14 days. Review "{stagnantDeals[0].name}"{stagnantDeals.length > 1 ? `and ${stagnantDeals.length - 1} other${stagnantDeals.length > 2 ? 's' : ''}` : ''} to prevent pipeline stall.
                          </div>
                        </div>
                      )}
                      <div className="p-4 bg-theme-accent/10 rounded-lg border border-theme-accent/20 flex gap-3">
                        <div className="text-theme-accent shrink-0 text-base">{recentlyWon.length > 0 ? '✅' : '📊'}</div>
                        <div>
                          <span className="font-semibold block text-theme-primary">Pipeline Velocity</span>
                          {recentlyWon.length > 0
                            ? `${recentlyWon.length} deal${recentlyWon.length > 1 ? 's' : ''} won in last 30 days. `
                            : 'No deals won in last 30 days. '}
                          {recentlyLost.length > 0
                            ? `${recentlyLost.length} deal${recentlyLost.length > 1 ? 's' : ''} lost. `
                            : 'No recent losses. '}
                          Total pipeline value: ${totalOpenValue.toLocaleString()}.
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB: WIN/LOSS ANALYSIS */}
        {activeSubTab === 'winloss' && (
          <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border space-y-6">
            <div>
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <PieChart className="w-5 h-5 text-theme-accent" />
                Win / Loss Analysis & Competitor Intel
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Deconstructing deal metrics by outcomes, competitors, and underlying reasons.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lost Reason Breakdown */}
              <div className="p-4 bg-theme-base/30 rounded-lg border border-theme-border">
                <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Lost Reason Attribution</h4>
                
                <div className="space-y-3">
                  {(() => {
                    const lostWithReasons = lostDeals.filter(d => d.lost_reason);
                    if (lostWithReasons.length === 0) {
                      return <p className="text-xs text-theme-secondary">No lost deal data available yet.</p>;
                    }
                    const reasonCounts: Record<string, number> = {};
                    lostWithReasons.forEach(d => {
                      const reason = d.lost_reason || 'Unspecified';
                      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                    });
                    const total = lostWithReasons.length;
                    const opacities = ['bg-theme-accent/70', 'bg-theme-accent/45', 'bg-theme-secondary/40', 'bg-theme-secondary/30'];
                    return Object.entries(reasonCounts)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([reason, count], i) => {
                        const pct = (count / total) * 100;
                        return (
                          <div key={reason}>
                            <div className="flex justify-between text-xs text-theme-secondary font-semibold mb-1">
                              <span>{reason}</span>
                              <span>{pct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-theme-base h-2 rounded-full overflow-hidden">
                              <div className={`${opacities[i] || 'bg-theme-accent/30'} h-full rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>

              {/* Competitor Standings */}
              <div className="p-4 bg-theme-base/30 rounded-lg border border-theme-border flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Key Competitor Head-to-Head</h4>
                  <p className="text-[11px] text-theme-secondary/80">Winning rates where competitors are logged</p>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  {(() => {
                    // Extract competitors dynamically from deal custom fields
                    const competitorStats: Record<string, { won: number; closed: number }> = {};
                    
                    scopedDeals.forEach(d => {
                      const compName = d.custom_fields?.competitor_name;
                      if (!compName || typeof compName !== 'string') return;
                      
                      const normalizedName = compName.trim();
                      if (!normalizedName) return;
                      
                      const stage = stages.find(s => s.id === d.stage_id);
                      if (!stage) return;
                      
                      if (!competitorStats[normalizedName]) {
                        competitorStats[normalizedName] = { won: 0, closed: 0 };
                      }
                      
                      if (stage.type === 'won') {
                        competitorStats[normalizedName].won += 1;
                        competitorStats[normalizedName].closed += 1;
                      } else if (stage.type === 'lost') {
                        competitorStats[normalizedName].closed += 1;
                      }
                    });

                    const statsArray = Object.entries(competitorStats);

                    if (statsArray.length === 0) {
                      return (
                        <div className="text-center py-6 text-[11px] text-theme-secondary">
                          No competitor interactions logged in active opportunities.
                        </div>
                      );
                    }

                    return statsArray.map(([name, stats]) => {
                      const winRate = stats.closed > 0 ? (stats.won / stats.closed) * 100 : 0;
                      return (
                        <div key={name} className="p-2 bg-theme-card rounded border border-theme-border flex justify-between items-center">
                          <span className="font-semibold text-theme-primary">{name}</span>
                          <span className="bg-theme-accent/10 text-theme-primary px-1.5 py-0.5 rounded text-[10px] font-bold font-sans">
                            {winRate.toFixed(0)}% Win Rate ({stats.closed} closed)
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB: CUSTOM REPORT BUILDER */}
        {activeSubTab === 'builder' && (
          <div className="space-y-6">
            <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border">
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-theme-accent" />
                Dynamic Custom Report Configurator
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Construct bespoke analytical spreadsheets. Segment by users, accounts, or dates instantly.
              </p>

              {/* Builder Controls */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 p-4 bg-theme-base/30 rounded-lg border border-theme-border">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Query Entity</label>
                  <select 
                    value={reportEntity} 
                    onChange={(e) => setReportEntity(e.target.value as any)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="deal">Sales Opportunities (Deals)</option>
                    <option value="contact">Business Contacts</option>
                    <option value="task">Tasks & Due Dates</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Grouping Column</label>
                  <select 
                    value={reportGrouping} 
                    onChange={(e) => setReportGrouping(e.target.value)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="owner_id">Assigned Owner (Sales Rep)</option>
                    {reportEntity === 'deal' && <option value="stage_id">Opportunity Stage</option>}
                    {(reportEntity === 'deal' || reportEntity === 'contact') && <option value="account_id">Account (Company)</option>}
                    {reportEntity === 'task' && <option value="type">Task Type</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Aggregated Metric</label>
                  <select 
                    value={reportMetric} 
                    onChange={(e) => setReportMetric(e.target.value as any)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="count">Count (Total Records)</option>
                    {reportEntity === 'deal' && <option value="sum_value">Sum of Monetary Value ($)</option>}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    className="w-full bg-theme-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Compile Report
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Report Display */}
            {reportGenerated && (
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Report Output</h4>
                  <button
                    onClick={handleExportCsv}
                    className="text-xs text-theme-accent hover:opacity-80 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Export as CSV
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-theme-border">
                  <table className="w-full text-left text-xs divide-y divide-theme-border">
                    <thead className="bg-theme-base font-bold text-theme-secondary uppercase font-sans text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Group Matrix</th>
                        <th className="px-4 py-3 text-right">Volume</th>
                        {reportEntity === 'deal' && reportMetric === 'sum_value' && <th className="px-4 py-3 text-right">Total Financial Value</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border text-theme-secondary">
                      {reportResult.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-theme-secondary/70">No matching record aggregates</td>
                        </tr>
                      ) : (
                        reportResult.map((row, idx) => (
                          <tr key={idx} className="hover:bg-theme-base/30">
                            <td className="px-4 py-3 font-semibold text-theme-primary">{row.groupName}</td>
                            <td className="px-4 py-3 text-right font-sans">{row.count}</td>
                            {reportEntity === 'deal' && reportMetric === 'sum_value' && (
                              <td className="px-4 py-3 text-right font-sans font-bold text-theme-primary">${row.value.toLocaleString()}</td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

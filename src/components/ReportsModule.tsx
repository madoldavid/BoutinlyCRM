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
  PieChart,
  GitPullRequest,
  FileDown,
  Sparkles,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Target,
  Zap,
  BarChart3,
  Users,
  Phone,
  UserX,
  Copy,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { FunnelChart, DonutChart, TrendLine, BarChart } from './ui/charts';
import { buildNextBestActions, findDuplicateContacts, type InsightContext } from '../ai/insights';
import { dispatchSelectEntity } from './GlobalShortcuts';
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

  // ─── Boutinly Intelligence ───
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

  // Metrics
  const wonDeals = scopedDeals.filter(d => stages.find(s => s.id === d.stage_id)?.type === 'won');
  const lostDeals = scopedDeals.filter(d => stages.find(s => s.id === d.stage_id)?.type === 'lost');
  const openDeals = scopedDeals.filter(d => stages.find(s => s.id === d.stage_id)?.type === 'open');

  const totalClosedDealsCount = wonDeals.length + lostDeals.length;
  const winRate = totalClosedDealsCount > 0 ? (wonDeals.length / totalClosedDealsCount) * 100 : 0;
  const totalOpenValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);

  const personalQuota = Number(currentUser?.custom_fields?.quota) || 0;
  const quotaAttainmentPct = personalQuota > 0 ? (totalWonValue / personalQuota) * 100 : 0;

  const isManagerOrAdmin = currentUser ? [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(currentUser.role) : false;

  // Trend data
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

  const activeStagesForChart = stages.filter(s => s.pipeline_id === activePipelineId);

  // CSV export
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

  const handleGenerateReport = () => {
    setReportGenerated(true);
    let results: any[] = [];

    if (reportEntity === 'deal') {
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
      results = Object.entries(groups).map(([groupName, items]) => ({
        groupName, count: items.length, value: items.reduce((sum, i) => sum + i.value, 0)
      }));
    } else if (reportEntity === 'contact') {
      const groups: Record<string, any[]> = {};
      contacts.forEach(c => {
        let key = '';
        if (reportGrouping === 'owner_id') key = users.find(u => u.id === c.owner_id)?.name || 'Unknown Rep';
        else if (reportGrouping === 'account_id') key = accounts.find(a => a.id === c.account_id)?.name || 'Unassigned Account';
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      results = Object.entries(groups).map(([groupName, items]) => ({ groupName, count: items.length, value: 0 }));
    } else if (reportEntity === 'task') {
      const groups: Record<string, Task[]> = {};
      scopedTasks.forEach(t => {
        let key = reportGrouping === 'owner_id'
          ? users.find(u => u.id === t.assigned_to_id)?.name || 'Unknown User'
          : t.type.toUpperCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
      results = Object.entries(groups).map(([groupName, items]) => ({ groupName, count: items.length, value: 0 }));
    }
    setReportResult(results);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base text-theme-primary">
      {/* Module Header */}
      <header className="bg-white border-b-2 border-theme-border px-6 py-4 shrink-0 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-theme-primary flex items-center gap-2.5 font-sans">
            <span className="w-9 h-9 rounded bg-theme-accent flex items-center justify-center shadow-sm"><TrendingUp className="w-5 h-5 text-white" /></span>
            Reports & Analytics
          </h2>
          <p className="text-xs text-theme-secondary mt-0.5 ml-11 font-medium">Real-time revenue forecast, team targets, and pipeline snapshots.</p>
        </div>
        <div className="flex items-center gap-1 bg-theme-inset p-1 rounded border border-theme-border text-xs font-bold shadow-sm">
          {[
            { id: 'dash' as const, label: isManagerOrAdmin ? 'Team Dashboard' : 'My Performance', icon: BarChart3 },
            { id: 'health' as const, label: 'Pipeline Health', icon: GitPullRequest },
            { id: 'winloss' as const, label: 'Win/Loss', icon: PieChart },
            { id: 'builder' as const, label: 'Custom Reports', icon: Sparkles },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition-all ${
                activeSubTab === tab.id
                  ? 'bg-white text-theme-accent shadow-sm border border-theme-border font-extrabold'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main scroll */}
      <div className="flex-1 overflow-y-auto p-6 font-sans">

        {/* ═══════════ SUB TAB: DASHBOARD ═══════════ */}
        {activeSubTab === 'dash' && (
          <div className="space-y-6">
            <SetupChecklist />

            {/* ── KPI ROW ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Open Pipeline', value: `$${totalOpenValue.toLocaleString()}`, sub: `${openDeals.length} active deals`,
                  icon: DollarSign, accent: 'border-l-theme-accent', iconBg: 'bg-theme-accent', iconFg: 'text-white', bar: 'bg-theme-accent',
                },
                {
                  label: 'Closed Won Revenue', value: `$${totalWonValue.toLocaleString()}`, sub: personalQuota > 0 ? `${Math.round(quotaAttainmentPct)}% of $${(personalQuota / 1000).toFixed(0)}k quota` : 'Set a quota target in your profile',
                  icon: Target, accent: 'border-l-success', iconBg: 'bg-success', iconFg: 'text-white', bar: 'bg-success',
                },
                {
                  label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${wonDeals.length} won · ${lostDeals.length} lost`,
                  icon: Percent, accent: 'border-l-info', iconBg: 'bg-info', iconFg: 'text-white', bar: 'bg-info',
                },
                {
                  label: 'Activities', value: scopedActivities.length.toLocaleString(), sub: 'Calls, notes, emails',
                  icon: Zap, accent: 'border-l-warning', iconBg: 'bg-warning', iconFg: 'text-white', bar: 'bg-warning',
                },
              ].map(kpi => (
                <div key={kpi.label} className={`bg-white border border-theme-border rounded shadow-sm overflow-hidden ${kpi.accent} border-l-[3px]`}>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-extrabold text-theme-secondary uppercase tracking-wider font-sans">{kpi.label}</span>
                      <span className={`w-8 h-8 rounded flex items-center justify-center shadow-sm ${kpi.iconBg}`}>
                        <kpi.icon className={`w-4 h-4 ${kpi.iconFg}`} />
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold text-theme-primary tnum tracking-tight" data-metric>{kpi.value}</p>
                    {/* Mini progress bar */}
                    <div className="mt-3 h-1.5 w-full bg-theme-inset rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${kpi.bar} transition-all duration-700`}
                        style={{ width: `${kpi.label === 'Win Rate' ? winRate : kpi.label === 'Open Pipeline' ? (personalQuota > 0 ? Math.min(100, (totalOpenValue / personalQuota) * 100) : 0) : kpi.label === 'Closed Won Revenue' ? (personalQuota > 0 ? Math.min(100, quotaAttainmentPct) : 0) : Math.min(100, (scopedActivities.length / 30) * 100)}%` }} />
                    </div>
                    <p className="text-2xs text-theme-secondary mt-2 font-semibold font-sans">{kpi.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── TWO COLUMN: Charts + AI ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Funnel */}
              <div className="bg-white border border-theme-border rounded shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-theme-primary uppercase tracking-wide font-sans mb-4 flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-theme-accent" /> Pipeline Funnel
                </h3>
                <FunnelChart money data={activeStagesForChart.map(stg => ({
                  label: stg.name,
                  value: scopedDeals.filter(d => d.stage_id === stg.id).reduce((sum, d) => sum + d.value, 0),
                }))} />
              </div>

              {/* Revenue Trend */}
              <div className="bg-white border border-theme-border rounded shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-theme-primary uppercase tracking-wide font-sans mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-theme-accent" /> Revenue Trend
                </h3>
                <TrendLine points={trendData.map(t => t.value)} labels={trendData.map(t => t.label)} money height={200} />
              </div>
            </div>

            {/* ── THREE COLUMN: AI Actions + Donut + Data Quality ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AI Next Best Actions */}
              <div className="bg-white border border-theme-border rounded shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-theme-primary uppercase tracking-wide font-sans mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-theme-accent" /> Next Best Actions
                </h3>
                {nextBestActions.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto text-success mb-3" />
                    <p className="text-sm font-bold text-theme-primary font-sans">All caught up</p>
                    <p className="text-xs text-theme-secondary mt-1">No urgent actions detected.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {nextBestActions.map(action => {
                      const tones: Record<string, { bg: string; text: string; bar: string }> = {
                        high: { bg: 'bg-danger-soft', text: 'text-danger', bar: 'bg-danger' },
                        medium: { bg: 'bg-warning-soft', text: 'text-warning', bar: 'bg-warning' },
                        low: { bg: 'bg-theme-inset', text: 'text-theme-secondary', bar: 'bg-theme-border' },
                      };
                      const t = tones[action.priority] || tones.low;
                      return (
                        <div key={action.id}
                          className="flex items-start gap-3 p-3 rounded border border-theme-border hover:border-theme-accent/40 hover:shadow-sm cursor-pointer transition-all bg-theme-inset/30"
                          onClick={() => { if (action.entityId) dispatchSelectEntity({ module: action.module, entityId: action.entityId }); }}
                        >
                          <div className={`w-1.5 self-stretch rounded-full shrink-0 ${t.bar}`} />
                          <div className="shrink-0">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${t.bg} ${t.text}`}>{action.priority}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-theme-primary">{action.title}</p>
                            <p className="text-2xs text-theme-secondary mt-0.5 leading-relaxed">{action.reason}</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-theme-secondary/30 shrink-0 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pipeline Distribution */}
              <div className="bg-white border border-theme-border rounded shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-theme-primary uppercase tracking-wide font-sans mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-theme-accent" /> Pipeline Distribution
                </h3>
                <DonutChart
                  data={activeStagesForChart.map(stg => ({
                    label: stg.name,
                    value: scopedDeals.filter(d => d.stage_id === stg.id).length,
                    color: stg.type === 'won' ? 'var(--success)' : stg.type === 'lost' ? 'var(--text-secondary)' : undefined,
                  }))}
                  centerLabel="Deals"
                />
              </div>

              {/* Data Quality */}
              <div className="bg-white border border-theme-border rounded shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-theme-primary uppercase tracking-wide font-sans mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-theme-accent" /> Data Quality
                </h3>
                <div className="space-y-3">
                  {[
                    { icon: Phone, label: 'Incomplete Contacts', count: dataQuality.incomplete, tone: dataQuality.incomplete > 0 ? 'warning' : 'success' as const },
                    { icon: UserX, label: 'Unassigned Contacts', count: dataQuality.unassigned, tone: dataQuality.unassigned > 0 ? 'warning' : 'success' as const },
                    { icon: Copy, label: 'Duplicate Contacts', count: dataQuality.duplicates, tone: dataQuality.duplicates > 0 ? 'danger' : 'success' as const },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded bg-theme-inset/50 border border-theme-border/50">
                      <div className="flex items-center gap-2.5">
                        <item.icon className="w-4 h-4 text-theme-secondary/60" />
                        <span className="text-xs font-semibold text-theme-primary font-sans">{item.label}</span>
                      </div>
                      <span className={`text-sm font-extrabold font-sans ${item.tone === 'danger' ? 'text-danger' : item.tone === 'warning' ? 'text-warning' : 'text-success'}`}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                  {duplicateGroups.length > 0 && (
                    <div className="pt-3 border-t border-theme-border space-y-1.5">
                      <p className="text-2xs font-bold text-theme-secondary uppercase tracking-wider">{duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''}</p>
                      {duplicateGroups.slice(0, 3).map((g, i) => (
                        <p key={i} className="text-2xs text-warning font-semibold bg-warning-soft/50 px-2 py-1 rounded">
                          {g.contacts.map(c => `${c.first_name} ${c.last_name}`).join(' ≈ ')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ SUB TAB: PIPELINE HEALTH ═══════════ */}
        {activeSubTab === 'health' && (
          <div className="bg-white rounded shadow-sm border border-theme-border p-6 space-y-7">
            <div>
              <h3 className="text-base font-extrabold text-theme-primary flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-theme-accent/10 flex items-center justify-center"><GitPullRequest className="w-4 h-4 text-theme-accent" /></span>
                Pipeline Conversion Funnel
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">Conversion degradation at each stage — identify friction bottlenecks.</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3 py-4">
              {stages.filter(s => s.pipeline_id === activePipelineId && s.type === 'open').length === 0 ? (
                <div className="text-center py-10 text-xs text-theme-secondary font-sans">
                  <GitPullRequest className="w-12 h-12 mx-auto mb-3 text-theme-border" />
                  <p className="font-bold text-theme-primary">No pipeline stages configured</p>
                  <p className="mt-1">Set up your pipeline stages in Admin to visualize the funnel.</p>
                </div>
              ) : (
                stages.filter(s => s.pipeline_id === activePipelineId && s.type === 'open').map((stg, index) => {
                  const dealsInStg = scopedDeals.filter(d => d.stage_id === stg.id);
                  const count = dealsInStg.length;
                  const val = dealsInStg.reduce((s, d) => s + d.value, 0);
                  const widthPct = Math.max(16, 100 - index * 14);
                  return (
                    <div key={stg.id} className="flex items-center gap-4">
                      <div className="w-36 text-right shrink-0">
                        <p className="text-xs font-extrabold text-theme-primary">{stg.name}</p>
                        <p className="text-2xs text-theme-secondary font-semibold">{stg.probability}% probability</p>
                      </div>
                      <div className="flex-1">
                        <div className="bg-theme-accent text-white text-xs font-extrabold py-2.5 px-4 rounded shadow-sm flex justify-between items-center transition-all" style={{ width: `${widthPct}%` }}>
                          <span>{count} Deal{count !== 1 ? 's' : ''}</span>
                          <span className="font-mono text-white/90">${val.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t-2 border-theme-border pt-5">
              <h4 className="text-xs font-extrabold uppercase font-sans tracking-wider text-theme-secondary mb-4">Health Diagnostics</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {(() => {
                  const stagnantDeals = openDeals.filter(d => new Date(d.stage_entered_at) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
                  const recentWon = wonDeals.filter(d => d.won_at && new Date(d.won_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                  const recentLost = lostDeals.filter(d => d.lost_at && new Date(d.lost_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                  return (
                    <>
                      {stagnantDeals.length > 0 && (
                        <div className="p-4 bg-warning-soft border border-warning/20 rounded flex gap-3 items-start">
                          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-theme-primary">Stagnant Deal{stagnantDeals.length > 1 ? 's' : ''} Detected</p>
                            <p className="text-theme-secondary mt-1 leading-relaxed">
                              {stagnantDeals.length} deal{stagnantDeals.length > 1 ? 's' : ''} stuck in current stage over 14 days.
                              Review <strong>"{stagnantDeals[0].name}"</strong>{stagnantDeals.length > 1 ? ` and ${stagnantDeals.length - 1} other${stagnantDeals.length > 2 ? 's' : ''}` : ''}.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="p-4 bg-info-soft border border-info/20 rounded flex gap-3 items-start">
                        <Target className="w-5 h-5 text-info shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-theme-primary">Pipeline Velocity</p>
                          <p className="text-theme-secondary mt-1 leading-relaxed">
                            {recentWon.length > 0 ? `${recentWon.length} won in last 30 days. ` : 'No deals won in last 30 days. '}
                            {recentLost.length > 0 ? `${recentLost.length} lost. ` : 'No recent losses. '}
                            Open pipeline: <strong>${totalOpenValue.toLocaleString()}</strong>
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ SUB TAB: WIN/LOSS ═══════════ */}
        {activeSubTab === 'winloss' && (
          <div className="bg-white rounded shadow-sm border border-theme-border p-6 space-y-7">
            <div>
              <h3 className="text-base font-extrabold text-theme-primary flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-theme-accent/10 flex items-center justify-center"><PieChart className="w-4 h-4 text-theme-accent" /></span>
                Win / Loss Analysis
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">Deal outcomes, competitor intelligence, and lost reason breakdown.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lost Reason Breakdown */}
              <div className="p-5 bg-theme-inset/30 rounded border border-theme-border">
                <h4 className="text-xs font-extrabold uppercase font-sans tracking-wider text-theme-secondary mb-4">Lost Reason Attribution</h4>
                {(() => {
                  const lostWithReasons = lostDeals.filter(d => d.lost_reason);
                  if (lostWithReasons.length === 0) return <p className="text-xs text-theme-secondary py-4">No lost deal data available yet.</p>;
                  const reasonCounts: Record<string, number> = {};
                  lostWithReasons.forEach(d => { const r = d.lost_reason || 'Unspecified'; reasonCounts[r] = (reasonCounts[r] || 0) + 1; });
                  const total = lostWithReasons.length;
                  return Object.entries(reasonCounts).sort(([,a],[,b]) => b - a).slice(0, 6).map(([reason, count], i) => {
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={reason} className="mb-3 last:mb-0">
                        <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-theme-primary">{reason}</span><span className="text-theme-secondary">{pct}%</span></div>
                        <div className="w-full bg-theme-base h-2.5 rounded-full overflow-hidden"><div className="bg-theme-accent h-full rounded-full transition-all" style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }} /></div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Competitor Standings */}
              <div className="p-5 bg-theme-inset/30 rounded border border-theme-border">
                <h4 className="text-xs font-extrabold uppercase font-sans tracking-wider text-theme-secondary mb-4">Competitor Head-to-Head</h4>
                {(() => {
                  const compStats: Record<string, { won: number; lost: number }> = {};
                  scopedDeals.forEach(d => {
                    const name = d.custom_fields?.competitor_name;
                    if (!name || typeof name !== 'string') return;
                    const s = stages.find(x => x.id === d.stage_id);
                    if (!s) return;
                    const key = name.trim();
                    if (!key || !compStats[key]) compStats[key] = { won: 0, lost: 0 };
                    if (s.type === 'won') compStats[key].won++;
                    else if (s.type === 'lost') compStats[key].lost++;
                  });
                  const arr = Object.entries(compStats);
                  if (!arr.length) return <p className="text-xs text-theme-secondary py-6 text-center">No competitor data logged yet.</p>;
                  return arr.sort(([,a],[,b]) => (b.won + b.lost) - (a.won + a.lost)).slice(0, 8).map(([name, s]) => {
                    const total = s.won + s.lost;
                    const wr = total > 0 ? Math.round((s.won / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center justify-between py-2.5 px-3 rounded border border-theme-border bg-white mb-2 last:mb-0">
                        <span className="text-xs font-bold text-theme-primary">{name}</span>
                        <div className="flex items-center gap-3 text-2xs font-bold">
                          <span className="flex items-center gap-1 text-success"><CheckCircle className="w-3 h-3" />{s.won} won</span>
                          <span className="flex items-center gap-1 text-danger"><XCircle className="w-3 h-3" />{s.lost} lost</span>
                          <span className="bg-theme-accent/10 text-theme-accent px-2 py-0.5 rounded font-extrabold">{wr}%</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ SUB TAB: CUSTOM REPORT BUILDER ═══════════ */}
        {activeSubTab === 'builder' && (
          <div className="space-y-6">
            <div className="bg-white rounded shadow-sm border border-theme-border p-6">
              <h3 className="text-base font-extrabold text-theme-primary flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-theme-accent/10 flex items-center justify-center"><Sparkles className="w-4 h-4 text-theme-accent" /></span>
                Custom Report Builder
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">Build analytical spreadsheets segmented by users, accounts, or stages.</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 p-5 bg-theme-inset/30 rounded border border-theme-border">
                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold uppercase tracking-wider text-theme-secondary font-sans">Entity</label>
                  <select value={reportEntity} onChange={(e) => setReportEntity(e.target.value as any)} className="w-full bg-white text-theme-primary rounded border border-theme-border px-3 py-2 text-sm font-semibold focus:border-theme-accent focus:outline-none h-10">
                    <option value="deal">Deals</option>
                    <option value="contact">Contacts</option>
                    <option value="task">Tasks</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold uppercase tracking-wider text-theme-secondary font-sans">Group By</label>
                  <select value={reportGrouping} onChange={(e) => setReportGrouping(e.target.value)} className="w-full bg-white text-theme-primary rounded border border-theme-border px-3 py-2 text-sm font-semibold focus:border-theme-accent focus:outline-none h-10">
                    <option value="owner_id">Owner</option>
                    {reportEntity === 'deal' && <option value="stage_id">Stage</option>}
                    {(reportEntity === 'deal' || reportEntity === 'contact') && <option value="account_id">Account</option>}
                    {reportEntity === 'task' && <option value="type">Task Type</option>}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold uppercase tracking-wider text-theme-secondary font-sans">Metric</label>
                  <select value={reportMetric} onChange={(e) => setReportMetric(e.target.value as any)} className="w-full bg-white text-theme-primary rounded border border-theme-border px-3 py-2 text-sm font-semibold focus:border-theme-accent focus:outline-none h-10">
                    <option value="count">Count</option>
                    {reportEntity === 'deal' && <option value="sum_value">Total Value ($)</option>}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={handleGenerateReport}
                    className="w-full bg-theme-accent hover:brightness-95 text-white font-extrabold py-2.5 px-4 rounded text-sm transition-all cursor-pointer flex items-center justify-center gap-2 h-10 shadow-sm">
                    <RefreshCw className="w-4 h-4" /> Compile Report
                  </button>
                </div>
              </div>
            </div>

            {reportGenerated && (
              <div className="bg-white rounded shadow-sm border border-theme-border p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-extrabold uppercase font-sans tracking-wider text-theme-primary">Report Output</h4>
                  <button onClick={handleExportCsv} className="flex items-center gap-1.5 text-sm font-bold text-theme-accent hover:opacity-80 cursor-pointer">
                    <FileDown className="w-4 h-4" /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto rounded border border-theme-border">
                  <table className="w-full text-left text-sm divide-y divide-theme-border">
                    <thead className="bg-theme-inset font-extrabold text-theme-secondary uppercase font-sans text-xs">
                      <tr>
                        <th className="px-5 py-3">Group</th>
                        <th className="px-5 py-3 text-right">Count</th>
                        {reportEntity === 'deal' && reportMetric === 'sum_value' && <th className="px-5 py-3 text-right">Total Value</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border">
                      {reportResult.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-10 text-center text-theme-secondary font-medium">No matching records</td></tr>
                      ) : reportResult.map((row, idx) => (
                        <tr key={idx} className="hover:bg-theme-hover/50 transition-colors">
                          <td className="px-5 py-3 font-bold text-theme-primary">{row.groupName}</td>
                          <td className="px-5 py-3 text-right font-semibold">{row.count}</td>
                          {reportEntity === 'deal' && reportMetric === 'sum_value' && (
                            <td className="px-5 py-3 text-right font-extrabold text-theme-accent">${row.value.toLocaleString()}</td>
                          )}
                        </tr>
                      ))}
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

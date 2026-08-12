/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCRM } from '../store';
import { useFeatureFlag } from '../utils/featureFlags';
import { UserRole } from '../types';
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
  Loader2,
} from 'lucide-react';
import { FunnelChart, DonutChart, TrendLine, BarChart } from './ui/charts';
import { dispatchSelectEntity, NEW_RECORD_EVENT } from './GlobalShortcuts';
import SetupChecklist from './SetupChecklist';
import { Skeleton, toast } from './ui';

// ─── Type helpers for API response shapes ──────────────────────────────────

interface MappedAction {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  entityId?: string;
  module: 'contacts' | 'deals' | 'tasks';
}

interface DuplicateGroup {
  contacts: Array<{ id: string; first_name: string; last_name: string }>;
  confidence: number;
  matchingFields: string[];
}

interface ForecastData {
  confidence: number;
  expectedRevenue: number;
  bestCase: number;
  worstCase: number;
  byMonth: Record<string, number>;
}

interface PipelineHealthData {
  totalValue: number;
  weightedValue: number;
  avgProbability: number;
  winRate: number;
  openDealsCount: number;
  wonCount: number;
  lostCount: number;
  closedCount: number;
  stageBreakdown: Array<{ stageId: string; stageName: string; count: number; value: number }>;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  revenue: number;
  dealsClosed: number;
  winRate: number;
}

interface CustomReportData {
  rows: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
}

export default function ReportsModule() {
  const {
    currentUser,
    getScopedDeals,
    getScopedTasks,
    getScopedActivities,
    contacts,
    users,
    stages,
    activePipelineId,
    setActiveModule,
    getNextBestActions,
    findDuplicates,
    getForecast,
    getLeaderboard,
    getPipelineHealth,
    getCustomReport,
  } = useCRM();

  const aiFeaturesEnabled = useFeatureFlag('ai_features');

  const [activeSubTab, setActiveSubTab] = useState<'dash' | 'health' | 'winloss' | 'builder'>('dash');

  // ─── API-backed data state ────────────────────────────────────────────────
  const [insightActions, setInsightActions] = useState<MappedAction[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [pipelineHealthData, setPipelineHealthData] = useState<PipelineHealthData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);

  // ─── Loading & error state ────────────────────────────────────────────────
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // ─── Custom Report Builder states ─────────────────────────────────────────
  const [reportEntity, setReportEntity] = useState<'contact' | 'account' | 'deal' | 'task'>('deal');
  const [reportGrouping, setReportGrouping] = useState<string>('owner_id');
  const [reportMetric, setReportMetric] = useState<'count' | 'sum_value'>('sum_value');
  const [reportResult, setReportResult] = useState<CustomReportData | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);

  // ─── Win/Loss report state ────────────────────────────────────────────────
  const [lostReasonData, setLostReasonData] = useState<CustomReportData | null>(null);
  const [competitorData, setCompetitorData] = useState<CustomReportData | null>(null);

  const scopedDeals = getScopedDeals();
  const scopedTasks = getScopedTasks();
  const scopedActivities = getScopedActivities();

  const isManagerOrAdmin = currentUser
    ? [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(currentUser.role)
    : false;

  // ─── Generic fetch wrapper ────────────────────────────────────────────────

  const fetchWithState = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, setter: (data: T) => void) => {
      setLoading(prev => ({ ...prev, [key]: true }));
      setErrors(prev => ({ ...prev, [key]: null }));
      try {
        const data = await fn();
        setter(data);
      } catch (err) {
        // Surface real request failures (4xx/5xx) so the caller can render an
        // error state instead of disguising them as an empty result. Logging to
        // the console is intentional — the user-reported bug masked /api/reports
        // failures behind generic "no data" copy with no diagnostic trail.
        console.error(`[Reports] ${key} request failed:`, err);
        setErrors(prev => ({ ...prev, [key]: err instanceof Error ? err.message : 'Failed to load. Please try again.' }));
        toast.error(`Could not load ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    },
    [],
  );

  // ─── Fetch all insight/report data ───────────────────────────────────────

  const loadAllDashboardData = useCallback(() => {
    // AI insights (gated behind ai_features flag)
    if (aiFeaturesEnabled) {
      fetchWithState('nextBestActions', getNextBestActions, (actions) => {
        const mapped: MappedAction[] = actions.map((a, i) => ({
          id: `action-${i}`,
          title: a.action,
          reason: a.rationale,
          priority: a.priority,
          entityId: a.deal_id || a.contact_id,
          module: a.deal_id ? 'deals' : 'contacts',
        }));
        setInsightActions(mapped);
      });

      fetchWithState('duplicates', findDuplicates, (dupes) => {
        const grouped: DuplicateGroup[] = dupes.map(d => ({
          contacts: [
            { id: d.contact_a.id, first_name: d.contact_a.first_name, last_name: d.contact_a.last_name },
            { id: d.contact_b.id, first_name: d.contact_b.first_name, last_name: d.contact_b.last_name },
          ],
          confidence: d.confidence,
          matchingFields: d.matching_fields,
        }));
        setDuplicateGroups(grouped);
      });
    }

    fetchWithState('forecast', getForecast, (f) => {
      setForecastData({
        confidence: f.confidence ?? 0,
        expectedRevenue: f.expected_revenue ?? 0,
        bestCase: f.best_case ?? 0,
        worstCase: f.worst_case ?? 0,
        byMonth: f.by_month ?? {},
      });
    });

    fetchWithState('pipelineHealth', () => getPipelineHealth({ pipelineId: activePipelineId || undefined }), (ph) => {
      setPipelineHealthData({
        totalValue: ph.total_value ?? 0,
        weightedValue: ph.weighted_value ?? 0,
        avgProbability: ph.avg_probability ?? 0,
        winRate: ph.win_rate ?? 0,
        openDealsCount: ph.open_deals_count ?? 0,
        wonCount: ph.won_count ?? 0,
        lostCount: ph.lost_count ?? 0,
        closedCount: ph.closed_count ?? 0,
        stageBreakdown: (ph.stage_breakdown ?? []).map(s => ({
          stageId: s.stage_id ?? '',
          stageName: s.stage_name ?? 'Unknown',
          count: s.count ?? 0,
          value: s.value ?? 0,
        })),
      });
    });

    fetchWithState('leaderboard', () => getLeaderboard({ limit: 10 }), (lb) => {
      setLeaderboardData(
        lb.map(e => ({
          userId: e.user_id,
          userName: e.user_name,
          revenue: e.revenue,
          dealsClosed: e.deals_closed,
          winRate: e.win_rate,
        })),
      );
    });
  }, [fetchWithState, getNextBestActions, findDuplicates, getForecast, getPipelineHealth, getLeaderboard, aiFeaturesEnabled, activePipelineId]);

  // "+" New button → navigate to Pipeline and trigger deal creation
  useEffect(() => {
    const onNew = () => {
      setActiveModule('deals');
      // Re-dispatch after module mounts so PipelineModule picks it up
      setTimeout(() => window.dispatchEvent(new Event(NEW_RECORD_EVENT)), 100);
    };
    window.addEventListener(NEW_RECORD_EVENT, onNew);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNew);
  }, [setActiveModule]);

  // Load data on mount
  useEffect(() => {
    loadAllDashboardData();
  }, [loadAllDashboardData]);

  // Reload when pipeline changes
  useEffect(() => {
    fetchWithState('pipelineHealth', () => getPipelineHealth({ pipelineId: activePipelineId || undefined }), (ph) => {
      setPipelineHealthData({
        totalValue: ph.total_value ?? 0,
        weightedValue: ph.weighted_value ?? 0,
        avgProbability: ph.avg_probability ?? 0,
        winRate: ph.win_rate ?? 0,
        openDealsCount: ph.open_deals_count ?? 0,
        wonCount: ph.won_count ?? 0,
        lostCount: ph.lost_count ?? 0,
        closedCount: ph.closed_count ?? 0,
        stageBreakdown: (ph.stage_breakdown ?? []).map(s => ({
          stageId: s.stage_id ?? '',
          stageName: s.stage_name ?? 'Unknown',
          count: s.count ?? 0,
          value: s.value ?? 0,
        })),
      });
    });
  }, [activePipelineId, fetchWithState, getPipelineHealth]);

  // ─── Fetch win/loss data when tab is active ──────────────────────────────
  const loadLostReasons = useCallback(() => {
    fetchWithState(
      'lostReasons',
      () => getCustomReport({ entity: 'deal', grouping: 'lost_reason', metric: 'count', filters: { stage_type: 'lost' } }),
      setLostReasonData,
    );
  }, [fetchWithState, getCustomReport]);

  const loadCompetitors = useCallback(() => {
    fetchWithState(
      'competitors',
      () => getCustomReport({ entity: 'deal', grouping: 'competitor_name', metric: 'count' }),
      setCompetitorData,
    );
  }, [fetchWithState, getCustomReport]);

  useEffect(() => {
    if (activeSubTab !== 'winloss') return;
    loadLostReasons();
    loadCompetitors();
  }, [activeSubTab, loadLostReasons, loadCompetitors]);

  // ─── Retry handler ────────────────────────────────────────────────────────

  const handleRetry = useCallback(
    (key: string) => {
      if (!aiFeaturesEnabled && (key === 'nextBestActions' || key === 'duplicates')) return;
      switch (key) {
        case 'nextBestActions':
          fetchWithState('nextBestActions', getNextBestActions, (actions) => {
            const mapped: MappedAction[] = actions.map((a, i) => ({
              id: `action-${i}`,
              title: a.action,
              reason: a.rationale,
              priority: a.priority,
              entityId: a.deal_id || a.contact_id,
              module: a.deal_id ? 'deals' : 'contacts',
            }));
            setInsightActions(mapped);
          });
          break;
        case 'duplicates':
          fetchWithState('duplicates', findDuplicates, (dupes) => {
            const grouped: DuplicateGroup[] = dupes.map(d => ({
              contacts: [
                { id: d.contact_a.id, first_name: d.contact_a.first_name, last_name: d.contact_a.last_name },
                { id: d.contact_b.id, first_name: d.contact_b.first_name, last_name: d.contact_b.last_name },
              ],
              confidence: d.confidence,
              matchingFields: d.matching_fields,
            }));
            setDuplicateGroups(grouped);
          });
          break;
        case 'forecast':
          fetchWithState('forecast', getForecast, (f) => {
            setForecastData({
              confidence: f.confidence ?? 0,
              expectedRevenue: f.expected_revenue ?? 0,
              bestCase: f.best_case ?? 0,
              worstCase: f.worst_case ?? 0,
              byMonth: f.by_month ?? {},
            });
          });
          break;
        case 'pipelineHealth':
          fetchWithState('pipelineHealth', () => getPipelineHealth({ pipelineId: activePipelineId || undefined }), (ph) => {
            setPipelineHealthData({
              totalValue: ph.total_value ?? 0,
              weightedValue: ph.weighted_value ?? 0,
              avgProbability: ph.avg_probability ?? 0,
              winRate: ph.win_rate ?? 0,
              openDealsCount: ph.open_deals_count ?? 0,
              wonCount: ph.won_count ?? 0,
              lostCount: ph.lost_count ?? 0,
              closedCount: ph.closed_count ?? 0,
              stageBreakdown: (ph.stage_breakdown ?? []).map(s => ({
                stageId: s.stage_id ?? '',
                stageName: s.stage_name ?? 'Unknown',
                count: s.count ?? 0,
                value: s.value ?? 0,
              })),
            });
          });
          break;
        case 'leaderboard':
          fetchWithState('leaderboard', () => getLeaderboard({ limit: 10 }), (lb) => {
            setLeaderboardData(
              lb.map(e => ({
                userId: e.user_id,
                userName: e.user_name,
                revenue: e.revenue,
                dealsClosed: e.deals_closed,
                winRate: e.win_rate,
              })),
            );
          });
          break;
        // The Win/Loss tab's retry buttons must re-issue the report requests
        // that failed (otherwise the ErrorBlock's Retry action was silently
        // no-op'ed because these cases were missing from the switch).
        case 'lostReasons':
          loadLostReasons();
          break;
        case 'competitors':
          loadCompetitors();
          break;
      }
    },
    [fetchWithState, getNextBestActions, findDuplicates, getForecast, getPipelineHealth, getLeaderboard, loadLostReasons, loadCompetitors, activePipelineId],
  );

  // ─── Simple derived UI counts (memoized to avoid recomputation on unrelated renders) ──
  const openDealsCount = useMemo(
    () => scopedDeals.filter(d => stages.find(s => s.id === d.stage_id)?.type === 'open').length,
    [scopedDeals, stages],
  );
  const activitiesCount = useMemo(() => scopedActivities.length, [scopedActivities]);

  // Data quality: simple filter counts
  const incompleteContacts = useMemo(
    () => contacts.filter(c => !c.phone || !c.title || !c.email).length,
    [contacts],
  );
  const unassignedContacts = useMemo(
    () => contacts.filter(c => !users.some(u => u.id === c.owner_id)).length,
    [contacts, users],
  );
  const totalDuplicateContacts = useMemo(
    () => duplicateGroups.reduce((n, g) => n + g.contacts.length, 0),
    [duplicateGroups],
  );

  const personalQuota = Number(currentUser?.custom_fields?.quota) || 0;

  // ─── Custom Report handlers ──────────────────────────────────────────────

  const handleGenerateReport = useCallback(async () => {
    setReportGenerated(true);
    // Defensive: never send an aggregate the active entity can't compute.
    // "sum_value" is only valid for deals; collapse to "count" otherwise so
    // the request parameters always match what is visibly selected in the
    // dropdowns (the Metric select for non-deal entities only offers Count,
    // but the underlying state could still hold the stale deals-only value).
    const effectiveMetric = reportEntity === 'deal' ? reportMetric : 'count';
    await fetchWithState(
      'customReport',
      () =>
        getCustomReport({
          entity: reportEntity,
          grouping: reportGrouping,
          metric: effectiveMetric,
        }),
      setReportResult,
    );
  }, [reportEntity, reportGrouping, reportMetric, fetchWithState, getCustomReport]);

  const handleExportCsv = () => {
    if (!reportResult || reportResult.rows.length === 0) return;
    const headers = ['Group', 'Volume'];
    if (reportEntity === 'deal' && reportMetric === 'sum_value') headers.push('Total Value');
    const rows = reportResult.rows.map(row => {
      const vals = [
        String(row.groupName ?? row.group_name ?? row.label ?? 'Unknown'),
        String(row.count ?? 0),
      ];
      if (reportEntity === 'deal' && reportMetric === 'sum_value')
        vals.push(String(row.value ?? row.total_value ?? 0));
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

  // ─── Loading skeleton helpers ────────────────────────────────────────────

  const LoadingBlock = ({ lines = 3, className = '' }: { lines?: number; className?: string }) => (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );

  const ErrorBlock = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
      <AlertTriangle className="w-8 h-8 text-warning" />
      <p className="text-sm font-medium text-theme-secondary">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-theme-accent text-white hover:bg-theme-accent-strong transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  // ─── Trend data from forecast (memoized) ──────────────────────────────────

  const trendLabels = useMemo(
    () => forecastData?.byMonth
      ? Object.keys(forecastData.byMonth).map(m => {
          const [y, mo] = m.split('-');
          const d = new Date(Number(y), Number(mo) - 1, 1);
          return d.toLocaleDateString('en-US', { month: 'short' });
        })
      : [],
    [forecastData?.byMonth],
  );
  const trendValues = useMemo(
    () => forecastData?.byMonth ? Object.values(forecastData.byMonth) : [],
    [forecastData?.byMonth],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base text-theme-primary">
      {/* Module toolbar — segmented view switcher */}
      {/* Layout: tab bar owns its own row so its labels can never be squeezed
          by the adjacent subtitle text. The subtitle moves below the tabs on
          narrower layouts and stays on the right only when there's room. */}
      <header className="bg-theme-card border-b border-theme-border px-4 sm:px-6 py-3 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-theme-inset p-1 rounded-lg border border-theme-border text-xs font-semibold overflow-x-auto scrollbar-none min-w-0 flex-1">
            {[
              { id: 'dash' as const, label: isManagerOrAdmin ? 'Team Dashboard' : 'My Performance', icon: BarChart3 },
              { id: 'health' as const, label: 'Pipeline Health', icon: GitPullRequest },
              { id: 'winloss' as const, label: 'Win/Loss', icon: PieChart },
              { id: 'builder' as const, label: 'Custom Reports', icon: Sparkles },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-all shrink-0 whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border'
                    : 'border border-transparent text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === tab.id ? 'text-theme-accent' : ''}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-theme-secondary font-medium hidden xl:block shrink-0">Real-time revenue forecast, team targets, and pipeline snapshots.</p>
        </div>
        <p className="text-xs text-theme-secondary font-medium xl:hidden">Real-time revenue forecast, team targets, and pipeline snapshots.</p>
      </header>

      {/* Main scroll */}
      <div className="flex-1 overflow-y-auto p-6 font-sans">

        {/* ═══════════ SUB TAB: DASHBOARD ═══════════ */}
        {activeSubTab === 'dash' && (
          <div className="space-y-6">
            <SetupChecklist />

            {/* ── KPI ROW ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Open Pipeline */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5 hover:shadow-raised transition-shadow">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">Open Pipeline</span>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-theme-accent-soft text-theme-accent">
                    <DollarSign className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                </div>
                {loading.pipelineHealth ? (
                  <Skeleton className="h-8 w-28 mb-3" />
                ) : (
                  <p className="text-[26px] leading-none font-semibold text-theme-primary tnum tracking-tight" data-metric>
                    ${((pipelineHealthData?.totalValue ?? 0)).toLocaleString()}
                  </p>
                )}
                <div className="mt-3.5 h-1 w-full bg-theme-inset rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-all duration-700"
                    style={{
                      width: `${personalQuota > 0 ? Math.min(100, ((pipelineHealthData?.totalValue ?? 0) / personalQuota) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-2xs text-theme-secondary mt-2.5 font-medium font-sans">{openDealsCount} active deals</p>
              </div>

              {/* Closed Won / Forecast Revenue */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5 hover:shadow-raised transition-shadow">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">Forecast Revenue</span>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-success-soft text-success">
                    <Target className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                </div>
                {loading.forecast ? (
                  <Skeleton className="h-8 w-28 mb-3" />
                ) : (
                  <p className="text-[26px] leading-none font-semibold text-theme-primary tnum tracking-tight" data-metric>
                    ${((forecastData?.expectedRevenue ?? 0)).toLocaleString()}
                  </p>
                )}
                <div className="mt-3.5 h-1 w-full bg-theme-inset rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-700"
                    style={{
                      width: `${personalQuota > 0 ? Math.min(100, ((forecastData?.expectedRevenue ?? 0) / personalQuota) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-2xs text-theme-secondary mt-2.5 font-medium font-sans">
                  {forecastData
                    ? `${Math.round(forecastData.confidence)}% confidence · Best $${forecastData.bestCase.toLocaleString()}`
                    : personalQuota > 0
                      ? `Set a quota target in your profile`
                      : 'Loading forecast...'}
                </p>
              </div>

              {/* Win Rate */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5 hover:shadow-raised transition-shadow">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">Win Rate</span>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-info-soft text-info">
                    <Percent className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                </div>
                {loading.pipelineHealth ? (
                  <Skeleton className="h-8 w-20 mb-3" />
                ) : (pipelineHealthData && pipelineHealthData.closedCount > 0) ? (
                  <p className="text-[26px] leading-none font-semibold text-theme-primary tnum tracking-tight" data-metric>
                    {Math.round(pipelineHealthData.winRate)}%
                  </p>
                ) : (
                  <p className="text-[26px] leading-none font-semibold text-theme-secondary tnum tracking-tight" data-metric>
                    N/A
                  </p>
                )}
                {/* Hide the progress bar entirely when there is no closed-deal
                    data — showing a 0% bar next to "N/A" contradicts the
                    leaderboard's 0% win rate for the same user on the same page. */}
                {(pipelineHealthData && pipelineHealthData.closedCount > 0) && (
                  <div className="mt-3.5 h-1 w-full bg-theme-inset rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-info transition-all duration-700"
                      style={{ width: `${Math.min(100, pipelineHealthData.winRate)}%` }}
                    />
                  </div>
                )}
                <p className="text-2xs text-theme-secondary mt-2.5 font-medium font-sans">
                  {pipelineHealthData && pipelineHealthData.closedCount > 0
                    ? `${pipelineHealthData.wonCount} won · ${pipelineHealthData.lostCount} lost`
                    : 'No closed deals yet'}
                </p>
              </div>

              {/* Activities */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5 hover:shadow-raised transition-shadow">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">Activities</span>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-warning-soft text-warning">
                    <Zap className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                </div>
                <p className="text-[26px] leading-none font-semibold text-theme-primary tnum tracking-tight" data-metric>
                  {activitiesCount.toLocaleString()}
                </p>
                <div className="mt-3.5 h-1 w-full bg-theme-inset rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning transition-all duration-700"
                    style={{ width: `${Math.min(100, (activitiesCount / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-2xs text-theme-secondary mt-2.5 font-medium font-sans">Calls, notes, emails</p>
              </div>
            </div>

            {/* ── TWO COLUMN: Charts + AI ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Funnel */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-theme-accent" /> Pipeline Funnel
                </h3>
                {loading.pipelineHealth ? (
                  <LoadingBlock lines={4} className="py-4" />
                ) : errors.pipelineHealth ? (
                  <ErrorBlock message={errors.pipelineHealth} onRetry={() => handleRetry('pipelineHealth')} />
                ) : pipelineHealthData && pipelineHealthData.stageBreakdown.length > 0 ? (
                  <FunnelChart
                    money
                    data={pipelineHealthData.stageBreakdown.map(s => ({
                      id: s.stageId,
                      label: s.stageName,
                      value: s.value,
                    }))}
                  />
                ) : (
                  <p className="text-xs text-theme-secondary py-8 text-center">No pipeline data available.</p>
                )}
              </div>

              {/* Revenue Trend */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-theme-accent" /> Revenue Forecast
                </h3>
                {loading.forecast ? (
                  <LoadingBlock lines={3} className="py-4" />
                ) : errors.forecast ? (
                  <ErrorBlock message={errors.forecast} onRetry={() => handleRetry('forecast')} />
                ) : trendValues.length > 0 ? (
                  <TrendLine points={trendValues} labels={trendLabels} money height={200} />
                ) : (
                  <p className="text-xs text-theme-secondary py-8 text-center">No forecast data available.</p>
                )}
              </div>
            </div>

            {/* ── THREE COLUMN: AI Actions + Donut + Data Quality ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AI Next Best Actions */}
              {aiFeaturesEnabled && (
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-theme-accent" /> Next Best Actions
                </h3>
                {loading.nextBestActions ? (
                  <div className="space-y-3 py-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : errors.nextBestActions ? (
                  <ErrorBlock message={errors.nextBestActions} onRetry={() => handleRetry('nextBestActions')} />
                ) : insightActions.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto text-success mb-3" />
                    <p className="text-sm font-bold text-theme-primary font-sans">All caught up</p>
                    <p className="text-xs text-theme-secondary mt-1">No urgent actions detected.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {insightActions.map(action => {
                      const tones: Record<string, { bg: string; text: string; bar: string }> = {
                        high: { bg: 'bg-danger-soft', text: 'text-danger', bar: 'bg-danger' },
                        medium: { bg: 'bg-warning-soft', text: 'text-warning', bar: 'bg-warning' },
                        low: { bg: 'bg-theme-inset', text: 'text-theme-secondary', bar: 'bg-theme-border' },
                      };
                      const t = tones[action.priority] || tones.low;
                      return (
                        <div
                          key={action.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-theme-border hover:border-theme-accent/40 hover:shadow-card cursor-pointer transition-all bg-theme-inset/50"
                          onClick={() => {
                            if (action.entityId) dispatchSelectEntity({ module: action.module, entityId: action.entityId });
                          }}
                        >
                          <div className={`w-1.5 self-stretch rounded-full shrink-0 ${t.bar}`} />
                          <div className="shrink-0">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${t.bg} ${t.text}`}>
                              {action.priority}
                            </span>
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
              )}

              {/* Pipeline Distribution */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-theme-accent" /> Pipeline Distribution
                </h3>
                {loading.pipelineHealth ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-theme-accent" />
                  </div>
                ) : errors.pipelineHealth ? (
                  <ErrorBlock message={errors.pipelineHealth} onRetry={() => handleRetry('pipelineHealth')} />
                ) : pipelineHealthData && pipelineHealthData.stageBreakdown.length > 0 ? (
                  <DonutChart
                    data={pipelineHealthData.stageBreakdown.map(s => ({
                      id: s.stageId,
                      label: s.stageName,
                      value: s.count,
                    }))}
                    centerLabel="Deals"
                  />
                ) : (
                  <p className="text-xs text-theme-secondary py-10 text-center">No stage data available.</p>
                )}
              </div>

              {/* Data Quality */}
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-theme-accent" /> Data Quality
                </h3>
                <div className="space-y-3">
                  {([
                    {
                      icon: Phone,
                      label: 'Incomplete Contacts',
                      count: incompleteContacts,
                      tone: incompleteContacts > 0 ? 'warning' : 'success',
                    },
                    {
                      icon: UserX,
                      label: 'Unassigned Contacts',
                      count: unassignedContacts,
                      tone: unassignedContacts > 0 ? 'warning' : 'success',
                    },
                    ...(aiFeaturesEnabled ? [{
                      icon: Copy,
                      label: 'Duplicate Contacts',
                      count: totalDuplicateContacts,
                      tone: totalDuplicateContacts > 0 ? 'danger' : 'success',
                    } as const] : []),
                  ] as const).map(item => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-theme-inset/60 border border-theme-border/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className="w-4 h-4 text-theme-secondary/60" />
                        <span className="text-xs font-semibold text-theme-primary font-sans">{item.label}</span>
                      </div>
                      {loading.duplicates && item.label === 'Duplicate Contacts' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-theme-secondary" />
                      ) : (
                        <span
                          className={`text-sm font-semibold tnum font-sans ${
                            item.tone === 'danger'
                              ? 'text-danger'
                              : item.tone === 'warning'
                                ? 'text-warning'
                                : 'text-success'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                  ))}
                  {aiFeaturesEnabled && duplicateGroups.length > 0 && (
                    <div className="pt-3 border-t border-theme-border space-y-1.5">
                      <p className="text-2xs font-bold text-theme-secondary uppercase tracking-wider">
                        {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''}
                      </p>
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

            {/* ── Leaderboard ── */}
            {isManagerOrAdmin && leaderboardData.length > 0 && (
              <div className="bg-theme-card border border-theme-border rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-theme-primary tracking-tight font-sans mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-theme-accent" /> Team Leaderboard
                </h3>
                {loading.leaderboard ? (
                  <LoadingBlock lines={5} />
                ) : errors.leaderboard ? (
                  <ErrorBlock message={errors.leaderboard} onRetry={() => handleRetry('leaderboard')} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary border-b border-theme-border">
                        <tr>
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">Rep</th>
                          <th className="py-3 px-4 text-right">Revenue</th>
                          <th className="py-3 px-4 text-right">Deals Won</th>
                          <th className="py-3 px-4 text-right">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border">
                        {leaderboardData.map((entry, i) => (
                          <tr key={entry.userId} className="hover:bg-theme-hover/50 transition-colors">
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-bold ${
                                  i === 0 ? 'text-theme-accent' : i < 3 ? 'text-theme-primary' : 'text-theme-secondary'
                                }`}
                              >
                                #{i + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-theme-primary text-xs">{entry.userName}</td>
                            <td className="py-3 px-4 text-right font-semibold tnum text-theme-accent text-xs">
                              ${entry.revenue.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-xs">{entry.dealsClosed}</td>
                            <td className="py-3 px-4 text-right font-semibold text-xs">{Math.round(entry.winRate)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ SUB TAB: PIPELINE HEALTH ═══════════ */}
        {activeSubTab === 'health' && (
          <div className="bg-theme-card rounded-xl shadow-card border border-theme-border p-6 space-y-7">
            <div>
              <h3 className="text-base font-semibold text-theme-primary tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-theme-accent-soft flex items-center justify-center">
                  <GitPullRequest className="w-4 h-4 text-theme-accent" />
                </span>
                Pipeline Health Overview
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">API-powered health metrics with weighted pipeline and stage breakdown.</p>
            </div>

            {loading.pipelineHealth ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : errors.pipelineHealth ? (
              <ErrorBlock message={errors.pipelineHealth} onRetry={() => handleRetry('pipelineHealth')} />
            ) : pipelineHealthData ? (
              <>
                {/* Health summary KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-theme-inset rounded-xl border border-theme-border text-center">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary mb-1">Total Pipeline</p>
                    <p className="text-2xl font-bold tnum text-theme-primary">${pipelineHealthData.totalValue.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-theme-inset rounded-xl border border-theme-border text-center">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary mb-1">Weighted Value</p>
                    <p className="text-2xl font-bold tnum text-theme-accent">${pipelineHealthData.weightedValue.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-theme-inset rounded-xl border border-theme-border text-center">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary mb-1">Avg Probability</p>
                    {pipelineHealthData.openDealsCount > 0 ? (
                      <p className="text-2xl font-bold tnum text-theme-primary">{Math.round(pipelineHealthData.avgProbability)}%</p>
                    ) : (
                      <p className="text-2xl font-bold tnum text-theme-secondary">N/A</p>
                    )}
                    <p className="text-2xs text-theme-secondary mt-1 font-medium font-sans">
                      {pipelineHealthData.openDealsCount > 0
                        ? `${pipelineHealthData.openDealsCount} open deal${pipelineHealthData.openDealsCount !== 1 ? 's' : ''}`
                        : 'No open deals'}
                    </p>
                  </div>
                </div>

                {/* Stage breakdown funnel */}
                <div className="max-w-2xl mx-auto space-y-3 py-4">
                  {pipelineHealthData.stageBreakdown.length === 0 ? (
                    <div className="text-center py-10 text-xs text-theme-secondary font-sans">
                      <GitPullRequest className="w-12 h-12 mx-auto mb-3 text-theme-border" />
                      <p className="font-bold text-theme-primary">No pipeline stages configured</p>
                      <p className="mt-1">Set up your pipeline stages in Admin to visualize the funnel.</p>
                    </div>
                  ) : (
                    pipelineHealthData.stageBreakdown.map((stg, index) => {
                      const maxVal = pipelineHealthData.stageBreakdown[0]?.value || 1;
                      const widthPct = Math.max(16, (stg.value / maxVal) * 100 - index * 10);
                      return (
                        <div key={stg.stageId || `${stg.stageName}-${index}`} className="flex items-center gap-4">
                          <div className="w-36 text-right shrink-0">
                            <p className="text-xs font-semibold text-theme-primary">{stg.stageName}</p>
                            <p className="text-2xs text-theme-secondary font-semibold">{stg.count} deal{stg.count !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex-1">
                            <div
                              className="bg-theme-accent text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-card flex justify-between items-center transition-all"
                              style={{ width: `${widthPct}%` }}
                            >
                              <span>{stg.count} Deal{stg.count !== 1 ? 's' : ''}</span>
                              <span className="font-mono text-white/90">${stg.value.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Health Diagnostics */}
                <div className="border-t border-theme-border pt-5">
                  <h4 className="text-xs font-semibold uppercase font-sans tracking-wider text-theme-secondary mb-4">Health Diagnostics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {pipelineHealthData.totalValue === 0 && (
                      <div className="p-4 bg-warning-soft border border-warning/20 rounded-xl flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-theme-primary">Empty Pipeline</p>
                          <p className="text-theme-secondary mt-1 leading-relaxed">
                            No deals currently in the pipeline. Start prospecting to build your pipeline.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="p-4 bg-info-soft border border-info/20 rounded-xl flex gap-3 items-start">
                      <Target className="w-5 h-5 text-info shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-theme-primary">Pipeline Velocity</p>
                        <p className="text-theme-secondary mt-1 leading-relaxed">
                          Weighted pipeline: <strong>${pipelineHealthData.weightedValue.toLocaleString()}</strong>.
                          {pipelineHealthData.avgProbability < 30
                            ? ' Average probability is low — focus on qualification.'
                            : pipelineHealthData.avgProbability > 60
                              ? ' Healthy deal progression.'
                              : ' Steady pipeline movement.'}
                        </p>
                      </div>
                    </div>
                    {pipelineHealthData.stageBreakdown.length > 2 && (
                      <div className="p-4 bg-theme-accent-soft/20 border border-theme-accent/20 rounded-xl flex gap-3 items-start md:col-span-2">
                        <BarChart3 className="w-5 h-5 text-theme-accent shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-theme-primary">Stage Distribution</p>
                          <p className="text-theme-secondary mt-1 leading-relaxed">
                            {pipelineHealthData.stageBreakdown.map(s => `${s.stageName}: ${s.count} ($${s.value.toLocaleString()})`).join(' · ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-theme-secondary py-8 text-center">No pipeline health data available.</p>
            )}
          </div>
        )}

        {/* ═══════════ SUB TAB: WIN/LOSS ═══════════ */}
        {activeSubTab === 'winloss' && (
          <div className="bg-theme-card rounded-xl shadow-card border border-theme-border p-6 space-y-7">
            <div>
              <h3 className="text-base font-semibold text-theme-primary tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-theme-accent-soft flex items-center justify-center">
                  <PieChart className="w-4 h-4 text-theme-accent" />
                </span>
                Win / Loss Analysis
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">Deal outcomes, competitor intelligence, and lost reason breakdown.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lost Reason Breakdown */}
              <div className="p-5 bg-theme-inset rounded-xl border border-theme-border">
                <h4 className="text-xs font-semibold uppercase font-sans tracking-wider text-theme-secondary mb-4">Lost Reason Attribution</h4>
                {loading.lostReasons ? (
                  <LoadingBlock lines={4} />
                ) : errors.lostReasons ? (
                  <ErrorBlock message={errors.lostReasons} onRetry={() => handleRetry('lostReasons')} />
                ) : lostReasonData && lostReasonData.rows.length > 0 ? (
                  (() => {
                    const total = lostReasonData.rows.reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0);
                    return lostReasonData.rows.slice(0, 6).map((row: any, i: number) => {
                      const count = Number(row.count) || 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const label = String(row.groupName ?? row.group_name ?? row.label ?? 'Unspecified');
                      return (
                        <div key={label} className="mb-3 last:mb-0">
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-theme-primary">{label}</span>
                            <span className="text-theme-secondary">{pct}%</span>
                          </div>
                          <div className="w-full bg-theme-base h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-theme-accent h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p className="text-xs text-theme-secondary py-4">No lost deal data available yet.</p>
                )}
              </div>

              {/* Competitor Standings */}
              <div className="p-5 bg-theme-inset rounded-xl border border-theme-border">
                <h4 className="text-xs font-semibold uppercase font-sans tracking-wider text-theme-secondary mb-4">Competitor Head-to-Head</h4>
                {loading.competitors ? (
                  <LoadingBlock lines={4} />
                ) : errors.competitors ? (
                  <ErrorBlock message={errors.competitors} onRetry={() => handleRetry('competitors')} />
                ) : competitorData && competitorData.rows.length > 0 ? (
                  competitorData.rows.slice(0, 8).map((row: any, i: number) => {
                    const name = String(row.groupName ?? row.group_name ?? row.label ?? `Competitor ${i + 1}`);
                    const won = Number(row.won ?? row.wins ?? 0);
                    const lost = Number(row.lost ?? row.losses ?? 0);
                    const count = Number(row.count ?? 0);
                    const total = won + lost || count;
                    const wr = total > 0 ? Math.round((won / total) * 100) : 0;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-theme-border bg-theme-card mb-2 last:mb-0"
                      >
                        <span className="text-xs font-semibold text-theme-primary">{name}</span>
                        <div className="flex items-center gap-3 text-2xs font-semibold">
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle className="w-3 h-3" />
                            {won} won
                          </span>
                          <span className="flex items-center gap-1 text-danger">
                            <XCircle className="w-3 h-3" />
                            {lost} lost
                          </span>
                          <span className="bg-theme-accent-soft text-theme-accent px-2 py-0.5 rounded-full">{wr}%</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-theme-secondary py-6 text-center">No competitor data logged yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ SUB TAB: CUSTOM REPORT BUILDER ═══════════ */}
        {activeSubTab === 'builder' && (
          <div className="space-y-6">
            <div className="bg-theme-card rounded-xl shadow-card border border-theme-border p-6">
              <h3 className="text-base font-semibold text-theme-primary tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-theme-accent-soft flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-theme-accent" />
                </span>
                Custom Report Builder
              </h3>
              <p className="text-xs text-theme-secondary mt-1 ml-10">Build analytical spreadsheets powered by the server-side reporting engine.</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 p-5 bg-theme-inset rounded-xl border border-theme-border">
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary font-sans">Entity</label>
                  <select
                    value={reportEntity}
                    onChange={e => {
                      const next = e.target.value as typeof reportEntity;
                      setReportEntity(next);
                      // Keep the visible Metric dropdown and the state that
                      // feeds the API request in sync: "Total Value ($)" only
                      // exists for Deals; any other entity falls back to Count
                      // so the request always matches what's visibly selected.
                      if (next !== 'deal') setReportMetric('count');
                    }}
                    className="w-full bg-theme-card text-theme-primary rounded-lg border border-theme-border px-3 text-sm font-medium focus:border-theme-accent focus:outline-none h-9"
                  >
                    <option value="deal">Deals</option>
                    <option value="contact">Contacts</option>
                    <option value="task">Tasks</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary font-sans">Group By</label>
                  <select
                    value={reportGrouping}
                    onChange={e => setReportGrouping(e.target.value)}
                    className="w-full bg-theme-card text-theme-primary rounded-lg border border-theme-border px-3 text-sm font-medium focus:border-theme-accent focus:outline-none h-9"
                  >
                    <option value="owner_id">Owner</option>
                    {reportEntity === 'deal' && <option value="stage_id">Stage</option>}
                    {(reportEntity === 'deal' || reportEntity === 'contact') && <option value="account_id">Account</option>}
                    {reportEntity === 'task' && <option value="type">Task Type</option>}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary font-sans">Metric</label>
                  <select
                    value={reportMetric}
                    onChange={e => setReportMetric(e.target.value as any)}
                    className="w-full bg-theme-card text-theme-primary rounded-lg border border-theme-border px-3 text-sm font-medium focus:border-theme-accent focus:outline-none h-9"
                  >
                    <option value="count">Count</option>
                    {reportEntity === 'deal' && <option value="sum_value">Total Value ($)</option>}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading.customReport}
                    className="w-full bg-theme-accent hover:bg-theme-accent-strong text-white font-semibold px-4 rounded-lg text-sm transition-all cursor-pointer flex items-center justify-center gap-2 h-9 shadow-card disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading.customReport ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}{' '}
                    Compile Report
                  </button>
                </div>
              </div>
            </div>

            {reportGenerated && (
              <div className="bg-theme-card rounded-xl shadow-card border border-theme-border p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold font-sans tracking-tight text-theme-primary">Report Output</h4>
                  <button
                    onClick={handleExportCsv}
                    disabled={!reportResult || reportResult.rows.length === 0}
                    className="flex items-center gap-1.5 text-sm font-bold text-theme-accent hover:opacity-80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileDown className="w-4 h-4" /> Export CSV
                  </button>
                </div>

                {loading.customReport ? (
                  <div className="py-8 space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : errors.customReport ? (
                  <ErrorBlock message={errors.customReport} onRetry={handleGenerateReport} />
                ) : reportResult && reportResult.rows.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-theme-border">
                    <table className="w-full text-left text-sm divide-y divide-theme-border">
                      <thead className="bg-theme-inset font-semibold text-theme-secondary uppercase font-sans text-2xs tracking-wider">
                        <tr>
                          <th className="px-5 py-3">Group</th>
                          <th className="px-5 py-3 text-right">Count</th>
                          {reportEntity === 'deal' && reportMetric === 'sum_value' && (
                            <th className="px-5 py-3 text-right">Total Value</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border">
                        {reportResult.rows.map((row: any, idx: number) => {
                          const groupLabel = String(
                            row.groupName ?? row.group_name ?? row.label ?? `Row ${idx + 1}`,
                          );
                          const count = Number(row.count ?? 0);
                          const value = Number(row.value ?? row.total_value ?? 0);
                          return (
                            <tr key={idx} className="hover:bg-theme-hover/50 transition-colors">
                              <td className="px-5 py-3 font-bold text-theme-primary">{groupLabel}</td>
                              <td className="px-5 py-3 text-right font-semibold">{count}</td>
                              {reportEntity === 'deal' && reportMetric === 'sum_value' && (
                                <td className="px-5 py-3 text-right font-semibold tnum text-theme-accent">
                                  ${value.toLocaleString()}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-xs text-theme-secondary font-medium">No matching records found.</p>
                  </div>
                )}

                {/* Summary row from API */}
                {reportResult?.summary && Object.keys(reportResult.summary).length > 0 && (
                  <div className="mt-4 p-4 bg-theme-inset rounded-lg border border-theme-border">
                    <h5 className="text-2xs font-semibold uppercase tracking-wider text-theme-secondary mb-2">Summary</h5>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(reportResult.summary).map(([key, val]) => (
                        <span key={key} className="text-xs font-semibold bg-theme-card text-theme-primary px-3 py-1.5 rounded-md border border-theme-border">
                          {key}: {typeof val === 'number' ? (val as number).toLocaleString() : String(val)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

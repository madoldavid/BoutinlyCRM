/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCRM } from '../store';
import { Deal, UserRole, DealLineItem } from '../types';
import { toast, ConfirmDialog, RecordDetailPage } from './ui';
import { FieldRow } from './ui/RecordDetailPage';
import { DataTable, type DataTableColumn } from './ui/DataTable';
import { useSavedViews, ViewSwitcher, type SavedView } from './ui/SavedViews';
import KanbanBoard from './ui/KanbanBoard';
import TimelinePanel from './ui/TimelinePanel';
import { NEW_RECORD_EVENT, SELECT_ENTITY_EVENT, type SelectEntityDetail } from './GlobalShortcuts';
import { exportCsv } from '../utils/exportCsv';
import { relativeDueLabel, formatDateTime } from '../utils/time';
import { printRecord } from '../utils/print';

// ─── Local deterministic helpers (replaces ai/insights for client)
type DealGrade = 'excellent' | 'good' | 'watch' | 'at_risk';

function gradeOf(score: number): DealGrade {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'watch';
  return 'at_risk';
}

const GRADE_META: Record<DealGrade, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  excellent: { label: 'Excellent', tone: 'success' },
  good:     { label: 'Good',      tone: 'info' },
  watch:    { label: 'Watch',     tone: 'warning' },
  at_risk:  { label: 'At Risk',   tone: 'danger' },
};

interface DealScoreData {
  score: number;
  grade: DealGrade;
  factors: Array<{ key: string; label: string; detail: string; impact: number }>;
  confidence: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
import {
  Briefcase,
  Layers,
  List,
  TrendingUp,
  Plus,
  Building,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Trash2,
  FileText,
  ShoppingBag,
  Package,
  Search,
  Download,
  Sparkles,
  GripVertical,
  DollarSign,
  User,
  Calendar,
  AlertTriangle,
  Printer,
  Maximize2,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';

export default function PipelineModule() {
  const {
    currentUser,
    users,
    accounts,
    pipelines,
    stages,
    getScopedDeals,
    addDeal,
    updateDeal,
    deleteDeal,
    moveDealStage,
    closeDeal,
    customFields,
    activePipelineId,
    setActivePipelineId,
    tasks,
    contacts,
    uploadFile,
    downloadFile,
    listFiles,
    deleteFile,
    getDealScore,
    getForecast,
  } = useCRM();

  // Deep-link from AI next-best-action → select the deal
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'deals') return;
      setSelectedDealId(detail.entityId);
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);

  // Delete confirmation
  const [confirmDeleteDealId, setConfirmDeleteDealId] = useState<string | null>(null);

  const scopedDeals = getScopedDeals();
  const activeStages = stages.filter(s => s.pipeline_id === activePipelineId);

  const [viewType, setViewType] = useState<'kanban' | 'list' | 'forecast'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepId, setSelectedRepId] = useState<string>('All');

  // ─── Saved views (G-FE-01, client layer) ───────────
  interface PipelineViewFilters {
    viewType: 'kanban' | 'list' | 'forecast';
    searchQuery: string;
    selectedRepId: string;
  }
  const { views, saveView, deleteView, setDefaultView, defaultView } = useSavedViews<PipelineViewFilters>('pipeline');

  const applyView = (view: SavedView<PipelineViewFilters>) => {
    setViewType(view.filters.viewType);
    setSearchQuery(view.filters.searchQuery);
    setSelectedRepId(view.filters.selectedRepId);
  };

  // Apply the default view once on mount
  useEffect(() => {
    if (defaultView) applyView(defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Selection / Drawer
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [fullDealDetail, setFullDealDetail] = useState<string | null>(null);

  // Modals
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCloseDealModal, setShowCloseDealModal] = useState(false);
  const [closingOutcome, setClosingOutcome] = useState<'won' | 'lost'>('won');
  const [lostReason, setLostReason] = useState('');

  // Products line item add state
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [lineItemForm, setLineItemForm] = useState({
    product_name: '',
    quantity: 1,
    unit_price: 0,
    discount_pct: 0
  });

  // Deal Form
  const [dealForm, setDealForm] = useState({
    name: '',
    stage_id: '',
    account_id: '',
    owner_id: currentUser?.id ?? '',
    value: 0,
    close_date: '',
    tags: '',
    custom_values: {} as Record<string, any>
  });

  // Attachments state — populated from API
  const [dealFiles, setDealFiles] = useState<Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Forecast data from API
  const [forecastData, setForecastData] = useState<{ confidence: number; expected_revenue: number; best_case: number; worst_case: number; by_month: Record<string, number> } | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [scoreRefreshing, setScoreRefreshing] = useState(false);

  // Filters
  const filteredDeals = scopedDeals.filter(d => {
    if (d.pipeline_id !== activePipelineId) return false;
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (accounts.find(a => a.id === d.account_id)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRep = selectedRepId === 'All' || d.owner_id === selectedRepId;
    return matchesSearch && matchesRep;
  });

  const activeDeal = scopedDeals.find(d => d.id === selectedDealId) || filteredDeals[0];

  // ─── Boutinly Intelligence: per-deal explainable scores (API-driven) ───
  const [dealScores, setDealScores] = useState<Map<string, DealScoreData>>(new Map());
  const [scoresLoading, setScoresLoading] = useState(false);

  const dealIdsKey = filteredDeals.map(d => d.id).sort().join(',');

  // Debounce timer for score loading — prevents a thundering herd of API
  // calls when the user rapidly changes search filters or pipeline views.
  const scoreDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialScoreLoad = useRef(true);

  useEffect(() => {
    // Clear any pending debounce timer from a previous effect invocation
    if (scoreDebounceTimer.current) clearTimeout(scoreDebounceTimer.current);

    // Fire immediately on the first load; debounce subsequent filter changes
    const delay = isInitialScoreLoad.current ? 0 : 400;
    isInitialScoreLoad.current = false;

    scoreDebounceTimer.current = setTimeout(() => {
      const cancelled = { value: false };
      async function loadScores() {
        setScoresLoading(true);
        const map = new Map<string, DealScoreData>();
        const dealIds = filteredDeals.map(d => d.id);
        // Process in batches of 5 to limit concurrent API requests
        const BATCH_SIZE = 5;
        for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
          if (cancelled.value) break;
          const batch = dealIds.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(dealId => getDealScore(dealId))
          );
          for (let j = 0; j < batch.length; j++) {
            if (cancelled.value) break;
            const result = results[j];
            if (result.status === 'fulfilled') {
              const { score, factors, confidence } = result.value;
              // Skip API fallback values (all zeros means the API call failed)
              if (score === 0 && factors.length === 0 && confidence === 0) continue;
              const grade = gradeOf(score);
              map.set(batch[j], {
                score,
                grade,
                factors: factors.map(f => ({
                  key: f.name.toLowerCase().replace(/\s+/g, '_'),
                  label: f.name,
                  detail: f.explanation,
                  impact: f.impact,
                })),
                confidence,
              });
            }
          }
        }
        if (!cancelled.value) {
          setDealScores(map);
          setScoresLoading(false);
        }
      }
      loadScores();
    }, delay);

    return () => {
      if (scoreDebounceTimer.current) clearTimeout(scoreDebounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealIdsKey]);

  const scoreMap = dealScores; // alias so existing references keep working

  // Calculations for Forecast
  const forecastMonths = (() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    }
    return months;
  })();

  // Client-side forecast fallback: compute KPI values from filtered deals
  // when the /api/insights/forecast endpoint is unreachable (offline mode).
  const clientForecast = useMemo(() => {
    if (filteredDeals.length === 0) return null;

    let weightedSum = 0;
    let rawSum = 0;
    let totalScore = 0;
    let dealsWithScore = 0;

    for (const deal of filteredDeals) {
      rawSum += deal.value;
      const stageProb = stages.find(s => s.id === deal.stage_id)?.probability ?? 0;
      const prob = deal.probability != null ? deal.probability : stageProb;
      weightedSum += deal.value * (prob / 100);
      const score = scoreMap.get(deal.id);
      if (score) {
        totalScore += score.score;
        dealsWithScore++;
      }
    }

    // Best case = raw pipeline total, Worst case = conservative 50% of weighted
    const avgScore = dealsWithScore > 0 ? totalScore / dealsWithScore : 50;

    return {
      expected_revenue: Math.round(weightedSum),
      best_case: Math.round(rawSum),
      worst_case: Math.round(weightedSum * 0.5),
      confidence: Math.round(avgScore),
    };
  }, [filteredDeals, stages, scoreMap]);

  const apiHasForecastData = forecastData && (
    forecastData.expected_revenue > 0 ||
    forecastData.best_case > 0 ||
    forecastData.worst_case > 0 ||
    forecastData.confidence > 0
  );
  const displayForecast = apiHasForecastData ? forecastData : clientForecast;
  const forecastIsClientSide = !apiHasForecastData && clientForecast != null;

  // ─── Load deal files from API when selected deal changes ───
  useEffect(() => {
    if (!activeDeal) return;
    let cancelled = false;
    async function load() {
      setFilesLoading(true);
      try {
        const files = await listFiles({ entity_type: 'deal', entity_id: activeDeal.id });
        if (!cancelled) setDealFiles(files);
      } catch {
        if (!cancelled) setDealFiles([]);
      }
      if (!cancelled) setFilesLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [activeDeal?.id, listFiles]);

  // ─── Load forecast from API when switching to forecast view ───
  useEffect(() => {
    if (viewType !== 'forecast') return;
    let cancelled = false;
    async function load() {
      setForecastLoading(true);
      try {
        const result = await getForecast();
        if (!cancelled) setForecastData(result);
      } catch {
        if (!cancelled) setForecastData(null);
      }
      if (!cancelled) setForecastLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [viewType, getForecast]);

  // ─── File upload / download / delete handlers ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDeal) return;
    setUploading(true);
    try {
      await uploadFile(file, 'deal', activeDeal.id);
      const files = await listFiles({ entity_type: 'deal', entity_id: activeDeal.id });
      setDealFiles(files);
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Could not upload file');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      setDealFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch (err: any) {
      toast.error('Delete failed', err?.message || 'Could not delete file');
    }
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    try {
      await downloadFile(fileId);
    } catch (err: any) {
      toast.error('Download failed', err?.message || 'Could not download file');
    }
  };

  const handleRefreshScore = async () => {
    if (!activeDeal) return;
    setScoreRefreshing(true);
    try {
      const result = await getDealScore(activeDeal.id);
      const grade = gradeOf(result.score);
      setDealScores(prev => {
        const next = new Map(prev);
        next.set(activeDeal.id, {
          score: result.score,
          grade,
          factors: result.factors.map(f => ({
            key: f.name.toLowerCase().replace(/\s+/g, '_'),
            label: f.name,
            detail: f.explanation,
            impact: f.impact,
          })),
          confidence: result.confidence,
        });
        return next;
      });
      toast.success('Score refreshed');
    } catch (err: any) {
      toast.error('Score refresh failed', err?.message || 'Could not refresh score');
    }
    setScoreRefreshing(false);
  };

  // ─── CSV export (list view) ───
  const handleExportDeals = () => {
    exportCsv(`boutinly-deals-${new Date().toISOString().slice(0, 10)}.csv`, filteredDeals, [
      { key: 'name', header: 'Deal' },
      { key: 'value', header: 'Value (USD)', format: d => d.value.toLocaleString('en-US') },
      { key: 'stage', header: 'Stage', format: d => stages.find(s => s.id === d.stage_id)?.name ?? '' },
      { key: 'probability', header: 'Probability (%)', format: d => `${d.probability ?? stages.find(s => s.id === d.stage_id)?.probability ?? 0}%` },
      { key: 'account', header: 'Account', format: d => accounts.find(a => a.id === d.account_id)?.name ?? '' },
      { key: 'owner', header: 'Owner', format: d => users.find(u => u.id === d.owner_id)?.name ?? '' },
      { key: 'close_date', header: 'Close Date', format: d => new Date(d.close_date).toISOString().slice(0, 10) },
      { key: 'score', header: 'Boutinly Score', format: d => String(scoreMap.get(d.id)?.score ?? '') },
      { key: 'stage_entered_at', header: 'Stage Entered', format: d => new Date(d.stage_entered_at).toISOString().slice(0, 10) },
    ]);
    toast.success('Deals exported', `${filteredDeals.length} rows → CSV`);
  };

  // Add line item to deal
  const handleAddLineItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeal) return;

    const total = lineItemForm.quantity * lineItemForm.unit_price * (1 - lineItemForm.discount_pct / 100);
    const newItem: DealLineItem = {
      id: 'li-' + crypto.randomUUID(),
      product_name: lineItemForm.product_name,
      quantity: Number(lineItemForm.quantity),
      unit_price: Number(lineItemForm.unit_price),
      discount_pct: Number(lineItemForm.discount_pct),
      total
    };

    const updatedLineItems = [...activeDeal.line_items, newItem];
    const updatedValue = updatedLineItems.reduce((sum, item) => sum + item.total, 0);

    updateDeal(activeDeal.id, {
      line_items: updatedLineItems,
      value: updatedValue
    });

    setShowLineItemForm(false);
  };

  // Submit Create Deal Form
  const handleCreateDealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultStage = activeStages[0];
    if (!defaultStage) return; // No stages configured
    addDeal({
      name: dealForm.name,
      pipeline_id: activePipelineId,
      stage_id: dealForm.stage_id || defaultStage.id,
      account_id: dealForm.account_id || '',
      owner_id: dealForm.owner_id,
      value: Number(dealForm.value),
      currency: 'USD',
      close_date: dealForm.close_date,
      custom_fields: dealForm.custom_values,
      line_items: []
    });
    setShowCreateDeal(false);
    setDealForm({
      name: '',
      stage_id: '',
      account_id: '',
      owner_id: currentUser?.id ?? '',
      value: 0,
      close_date: '',
      tags: '',
      custom_values: {}
    });
  };

  // Close Deal Trigger (Won or Lost)
  const triggerCloseDeal = (outcome: 'won' | 'lost') => {
    setClosingOutcome(outcome);
    setShowCloseDealModal(true);
  };

  const handleCloseDealConfirm = async () => {
    if (!activeDeal) return;
    const ok = await closeDeal(activeDeal.id, closingOutcome, closingOutcome === 'lost' ? lostReason : undefined);
    if (!ok) return; // Keep modal open on failure so the user can retry
    setShowCloseDealModal(false);
    setLostReason('');
  };

  // Stall alert calculator (14 days stagnant threshold)
  const isStalled = (deal: Deal) => {
    const elapsedMs = new Date().getTime() - new Date(deal.stage_entered_at).getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const activeStage = stages.find(s => s.id === deal.stage_id);
    return elapsedDays > 14 && activeStage?.type === 'open';
  };

  const isReadOnly = currentUser?.role === UserRole.VIEWER;

  // "n" shortcut → open create-deal modal (respects read-only role)
  useEffect(() => {
    const onNewRecord = () => { if (!isReadOnly) setShowCreateDeal(true); };
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, [isReadOnly]);

  // Escape-to-close for the two custom `fixed inset-0` overlays in this module
  // (Create Deal & Close-Deal Outcome). The documented global "Esc — Close
  // dialogs & overlays" behavior must apply to these too, not just to the
  // shared `<Modal>` usages elsewhere.
  useEffect(() => {
    if (!showCreateDeal && !showCloseDealModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showCreateDeal) { setShowCreateDeal(false); return; }
      if (showCloseDealModal) { setShowCloseDealModal(false); return; }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showCreateDeal, showCloseDealModal]);

  if (fullDealDetail) {
    const deal = scopedDeals.find(d => d.id === fullDealDetail);
    if (deal) {
      const dealAccount = accounts.find(a => a.id === deal.account_id);
      const dealOwner = users.find(u => u.id === deal.owner_id);
      const dealStage = stages.find(s => s.id === deal.stage_id);
      const dealScore = scoreMap.get(deal.id);
      const relatedTasks = tasks.filter(t => t.deal_id === deal.id);
      const relatedContacts = deal.account_id
        ? contacts.filter(c => c.account_id === deal.account_id)
        : [];

      return (
        <RecordDetailPage
          title={deal.name}
          subtitle={`${dealAccount?.name || 'Unassigned'} · ${dealStage?.name || 'Unknown Stage'}`}
          status={{
            label: dealStage?.name || 'Unknown',
            tone: dealStage?.type === 'won' ? 'success' : dealStage?.type === 'lost' ? 'danger' : 'info',
          }}
          onBack={() => setFullDealDetail(null)}
          users={users}
          timeline={<TimelinePanel entityType="deal" entityId={deal.id} readOnly={isReadOnly} />}
          highlightsPanel={
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs text-theme-secondary font-sans">Opportunity Value</span>
                <span className="text-base font-bold text-theme-primary tnum" data-metric>${deal.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-theme-inset rounded-full overflow-hidden mt-1 mb-3">
                <div className="h-full bg-theme-accent rounded-full transition-all" style={{ width: `${dealScore?.score ?? dealStage?.probability ?? 0}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-theme-inset rounded-lg p-2 text-center">
                  <span className="text-2xs text-theme-secondary block font-sans">Probability</span>
                  <span className="text-sm font-bold text-theme-primary tnum">{dealScore?.score ?? dealStage?.probability ?? 0}%</span>
                  {dealScore && (
                    <span className={`text-[10px] font-medium`} style={{ color: `var(--${GRADE_META[dealScore.grade]?.tone === 'warning' ? 'warning' : GRADE_META[dealScore.grade]?.tone === 'danger' ? 'danger' : GRADE_META[dealScore.grade]?.tone === 'info' ? 'info' : 'success'})` }}>{GRADE_META[dealScore.grade]?.label}</span>
                  )}
                </div>
                <div className="bg-theme-inset rounded-lg p-2 text-center">
                  <span className="text-2xs text-theme-secondary block font-sans">Total Items</span>
                  <span className="text-sm font-bold text-theme-primary tnum">{deal.line_items.length}</span>
                </div>
              </div>
            </div>
          }
          tabs={[
            {
              id: 'items',
              label: 'Line Items',
              count: deal.line_items.length,
              content: (
                <div>
                  {deal.line_items.length === 0 ? (
                    <p className="text-xs text-theme-secondary py-4 text-center">No line items</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-theme-border">
                          <th className="text-left py-2 font-semibold text-theme-secondary text-2xs uppercase tracking-wider font-sans">Product</th>
                          <th className="text-center py-2 font-semibold text-theme-secondary text-2xs uppercase tracking-wider font-sans">Qty</th>
                          <th className="text-right py-2 font-semibold text-theme-secondary text-2xs uppercase tracking-wider font-sans">Price</th>
                          <th className="text-right py-2 font-semibold text-theme-secondary text-2xs uppercase tracking-wider font-sans">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deal.line_items.map(item => (
                          <tr key={item.id} className="border-b border-theme-border/50">
                            <td className="py-2 text-theme-primary font-medium">{item.product_name}</td>
                            <td className="py-2 text-center text-theme-secondary">{item.quantity}</td>
                            <td className="py-2 text-right text-theme-secondary">${item.unit_price.toLocaleString()}</td>
                            <td className="py-2 text-right text-theme-primary font-semibold tnum">${item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ),
            },
            {
              id: 'contacts',
              label: 'Related Contacts',
              count: relatedContacts.length,
              content: (
                <div className="divide-y divide-theme-border">
                  {relatedContacts.length === 0 ? (
                    <p className="text-xs text-theme-secondary py-4 text-center">No contacts at this account</p>
                  ) : (
                    relatedContacts.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-theme-primary">{c.first_name} {c.last_name}</p>
                          <p className="text-2xs text-theme-secondary">{c.title} · {c.email}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
            {
              id: 'tasks',
              label: 'Tasks',
              count: relatedTasks.length,
              content: (
                <div className="divide-y divide-theme-border">
                  {relatedTasks.length === 0 ? (
                    <p className="text-xs text-theme-secondary py-4 text-center">No tasks linked</p>
                  ) : (
                    relatedTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-medium text-theme-primary">{t.title}</p>
                          <p className="text-2xs text-theme-secondary">{t.type} · Due {new Date(t.due_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-2xs font-sans px-1.5 py-0.5 rounded-full ${t.completed_at ? 'bg-success-soft text-success' : t.priority === 'high' ? 'bg-danger-soft text-danger' : 'bg-theme-inset text-theme-secondary'}`}>
                          {t.completed_at ? 'Done' : t.priority}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
          ]}
        >
          <div className="space-y-0">
            <FieldRow label="Account" value={dealAccount?.name || '—'} />
            <FieldRow label="Stage" value={dealStage?.name} />
            <FieldRow label="Probability" value={`${dealScore?.score ?? dealStage?.probability ?? 0}%`} />
            <FieldRow label={dealStage?.type !== 'open' ? 'Closed On' : 'Expected Close'} value={
              <span className={dealStage?.type === 'open' && new Date(deal.close_date) < new Date() ? 'text-danger' : ''}>
                {new Date(deal.close_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                <span className="block text-2xs text-theme-secondary">
                  {dealStage?.type !== 'open'
                    ? (dealStage?.type === 'won' ? 'Won' : 'Lost')
                    : relativeDueLabel(deal.close_date, currentUser?.timezone).text}
                </span>
              </span>
            } />
            <FieldRow label="Owner" value={dealOwner?.name || 'Unassigned'} />
            <FieldRow label="Currency" value={deal.currency} />
            <FieldRow label="Stage Entered" value={formatDateTime(deal.stage_entered_at, currentUser?.timezone)} />
            {deal.won_at && <FieldRow label="Won At" value={formatDateTime(deal.won_at, currentUser?.timezone)} />}
            {deal.lost_at && <FieldRow label="Lost At" value={formatDateTime(deal.lost_at, currentUser?.timezone)} />}
            {deal.lost_reason && <FieldRow label="Lost Reason" value={<span className="text-danger">{deal.lost_reason}</span>} />}
            {customFields.filter(f => f.entity_type === 'deal' && f.is_visible).map(f => (
              <FieldRow key={f.id} label={f.label} value={deal.custom_fields[f.key]?.toString() || '—'} />
            ))}
            {dealScore && (
              <>
                <FieldRow label="Boutinly Score" value={
                  <span className={`font-bold ${dealScore.score >= 75 ? 'text-success' : dealScore.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                    {dealScore.score}
                  </span>
                } />
                <FieldRow label="Confidence" value={`${dealScore.score >= 75 ? 'High' : dealScore.score >= 50 ? 'Medium' : 'Low'}`} />
                <FieldRow label="Factors" value={
                  <span className="text-2xs">{dealScore.factors.join(' · ')}</span>
                } />
              </>
            )}
          </div>
        </RecordDetailPage>
      );
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* MAIN SALES WORKSPACE COLUMN */}
      <div className={`${selectedDealId ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/2 min-w-0 flex-col border-r border-theme-border bg-theme-card h-full select-none`}>
        
        {/* Module Controls and Swappers */}
        <div className="p-3 sm:p-4 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-theme-accent shrink-0" />
              <select
                value={activePipelineId}
                onChange={(e) => setActivePipelineId(e.target.value)}
                className="bg-transparent text-sm font-semibold text-theme-primary focus:outline-none cursor-pointer border border-transparent hover:border-theme-border rounded-md px-1.5 py-0.5 min-w-0 max-w-[180px] truncate"
              >
                {pipelines.map(p => (
                  <option key={p.id} value={p.id} className="bg-theme-card text-theme-primary">{p.name}</option>
                ))}
              </select>
            </div>

            {/* Layout Toggle buttons */}
            <div className="flex items-center gap-0.5 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold shrink-0">
              <button
                onClick={() => setViewType('kanban')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewType === 'kanban' ? 'bg-theme-card text-theme-primary shadow-card' : 'text-theme-secondary hover:text-theme-primary'
                }`}
                title="Kanban Board"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewType === 'list' ? 'bg-theme-card text-theme-primary shadow-card' : 'text-theme-secondary hover:text-theme-primary'
                }`}
                title="Opportunities Grid"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('forecast')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewType === 'forecast' ? 'bg-theme-card text-theme-primary shadow-card' : 'text-theme-secondary hover:text-theme-primary'
                }`}
                title="Weighted Revenue Forecast"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search, Filter rep dropdown, saved views, and create deal */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Search opportunities…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-theme-card text-theme-primary border border-theme-border rounded-lg !pl-9 pr-3 text-sm focus:ring-2 focus:ring-theme-accent/10 focus:border-theme-accent focus:outline-none placeholder:text-theme-secondary/50"
              />
            </div>
            <ViewSwitcher
              views={views}
              onApply={applyView}
              onSaveCurrent={(name) => {
                saveView(name, { viewType, searchQuery, selectedRepId });
                toast.success(`View "${name}" saved.`);
              }}
              onDelete={deleteView}
              onSetDefault={setDefaultView}
            />
            {currentUser.role !== UserRole.SALES_REP && (
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="bg-theme-card border border-theme-border rounded-lg px-2 h-9 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-theme-accent cursor-pointer text-theme-primary shrink-0 max-w-[140px]"
              >
                <option value="All">All Owners</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {!isReadOnly && (
              <button
                onClick={() => setShowCreateDeal(true)}
                className="bg-theme-accent hover:bg-theme-accent-strong text-white px-3 h-9 rounded-lg flex items-center gap-1 text-xs font-semibold transition-colors shadow-card shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Opportunity
              </button>
            )}
          </div>
        </div>

        {/* VIEW: KANBAN BOARD */}
        {viewType === 'kanban' && (
          <KanbanBoard
            columns={activeStages.map(stg => {
              const dealsInStg = filteredDeals.filter(d => d.stage_id === stg.id);
              return {
                id: stg.id,
                title: stg.name,
                count: dealsInStg.length,
                totalValue: dealsInStg.reduce((sum, d) => sum + d.value, 0),
                color: stg.type === 'won' ? 'var(--success)' : stg.type === 'lost' ? 'var(--danger)' : undefined,
                cards: dealsInStg.map(deal => ({
                  id: deal.id,
                  title: deal.name,
                  value: deal.value,
                  currency: deal.currency,
                  owner: users.find(u => u.id === deal.owner_id)?.name || '',
                  closeDate: deal.close_date,
                  isClosed: stg.type !== 'open',
                  meta: { deal },
                })),
              };
            })}
            renderCard={card => {
              const deal = (card.meta?.deal ?? null) as Deal | null;
              const score = deal ? scoreMap.get(deal.id) : undefined;
              const meta = score ? GRADE_META[score.grade] : null;
              const hasStagnation = score?.factors.some(f => f.key === 'stagnation' && f.impact < 0) ?? false;
              const hasOverdueStep = score?.factors.some(f => f.key === 'next_step' && f.impact < 0) ?? false;
              return (
                <div className="bg-theme-card border border-theme-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-raised transition-shadow group">
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-3 h-3 text-theme-secondary/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-theme-primary truncate">{card.title}</p>
                        {score && meta && (
                          <span
                            className={`shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              meta.tone === 'success' ? 'text-success bg-success-soft border-success/20'
                              : meta.tone === 'info' ? 'text-info bg-info-soft border-info/20'
                              : meta.tone === 'warning' ? 'text-warning bg-warning-soft border-warning/20'
                              : 'text-danger bg-danger-soft border-danger/20'
                            }`}
                            title={`Boutinly Score ${score.score}/100 — ${meta.label}. ${score.factors.filter(f => f.impact < 0).map(f => f.label).join(', ') || 'No negative factors.'}`}
                          >
                            <Sparkles className="w-2 h-2" />
                            {score.score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-2xs text-theme-secondary">
                        {card.value !== undefined && (
                          <span className="flex items-center gap-0.5 font-mono tabular-nums">
                            <DollarSign className="w-2.5 h-2.5" />
                            {card.value.toLocaleString()}
                          </span>
                        )}
                        {card.owner && (
                          <span className="flex items-center gap-0.5 truncate">
                            <User className="w-2.5 h-2.5" />
                            {card.owner}
                          </span>
                        )}
                        {card.closeDate && (
                          (() => {
                            // Closed (won/lost) deals aren't "due" anymore — show a plain
                            // date, never the overdue/soon urgency styling.
                            const rel = card.isClosed
                              ? { tone: 'normal' as const, text: new Date(card.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
                              : relativeDueLabel(card.closeDate, currentUser?.timezone);
                            return (
                              <span
                                className={`flex items-center gap-0.5 ${
                                  rel.tone === 'overdue' ? 'text-danger font-medium'
                                  : rel.tone === 'soon' ? 'text-warning font-medium'
                                  : ''
                                }`}
                                title={formatDateTime(card.closeDate, currentUser?.timezone)}
                              >
                                <Calendar className="w-2.5 h-2.5" />
                                {rel.text}
                              </span>
                            );
                          })()
                        )}
                        {!card.isClosed && (hasStagnation || hasOverdueStep) && (
                          <span className="ml-auto flex items-center gap-0.5 text-warning font-medium" title={hasStagnation ? 'Stalled in stage — see score breakdown' : 'Overdue next step — see score breakdown'}>
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {hasStagnation ? 'stalled' : 'step overdue'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
            onCardMove={async (cardId, _fromId, toStageId) => {
              if (isReadOnly) return;
              const deal = filteredDeals.find(d => d.id === cardId);
              if (!deal) return;
              const toStage = activeStages.find(s => s.id === toStageId);
              if (!toStage) return;
              let ok = false;
              if (toStage.type === 'won') {
                ok = await closeDeal(cardId, 'won');
              } else if (toStage.type === 'lost') {
                ok = await closeDeal(cardId, 'lost');
              } else {
                ok = await moveDealStage(cardId, toStageId);
              }
              if (!ok) throw new Error(`The server rejected the stage change for deal "${deal.name}". The card will snap back to its original stage.`);
            }}
            loading={false}
          />
        )}

        {/* VIEW: DEALS LIST (sortable, filterable, exportable) */}
        {viewType === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
              <p className="text-xs text-theme-secondary font-sans">
                {filteredDeals.length} opportunity{filteredDeals.length === 1 ? '' : 's'} ·{' '}
                <span className="font-medium text-theme-primary">${filteredDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}</span> open pipeline
              </p>
              <button
                onClick={handleExportDeals}
                disabled={filteredDeals.length === 0}
                className="flex items-center gap-1.5 text-[11px] font-medium text-theme-secondary hover:text-theme-primary border border-theme-border rounded-md px-2.5 py-1.5 hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-theme-card"
                aria-label="Export opportunities to CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            <div className="flex-1 px-4 pb-4 overflow-auto min-h-0">
              <DataTable
                tableId="deals"
                data={filteredDeals as unknown as Record<string, unknown>[]}
                rowKey={d => String(d.id)}
                showDensityToggle
                emptyState={
                  <div className="bg-theme-card border border-theme-border rounded-[10px] p-10 text-center text-xs text-theme-secondary font-sans">
                    No opportunities match the current filters.
                  </div>
                }
                columns={[
                  {
                    key: 'name',
                    header: 'Deal',
                    minWidth: 180,
                    render: d => {
                      const deal = d as unknown as Deal;
                      return (
                        <button
                          onClick={() => setSelectedDealId(deal.id)}
                          className="text-left font-semibold text-theme-primary hover:text-theme-accent cursor-pointer bg-transparent border-none"
                        >
                          {deal.name}
                        </button>
                      );
                    },
                  },
                  {
                    key: 'value',
                    header: 'Value',
                    width: 110,
                    render: d => <span className="font-mono tabular-nums">${(d as unknown as Deal).value.toLocaleString()}</span>,
                  },
                  {
                    key: 'stage_id',
                    header: 'Stage',
                    minWidth: 150,
                    render: d => {
                      const stage = stages.find(s => s.id === (d as unknown as Deal).stage_id);
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-xs ${stage?.type === 'won' ? 'text-success' : stage?.type === 'lost' ? 'text-danger' : 'text-theme-primary'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stage?.type === 'won' ? 'bg-success' : stage?.type === 'lost' ? 'bg-danger' : 'bg-theme-accent'}`} aria-hidden="true" />
                          {stage?.name ?? 'Unknown'}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'probability',
                    header: 'Prob.',
                    width: 80,
                    render: d => {
                      const deal = d as unknown as Deal;
                      const prob = deal.probability ?? stages.find(s => s.id === deal.stage_id)?.probability ?? 0;
                      return <span className="tabular-nums">{prob}%</span>;
                    },
                  },
                  {
                    key: 'owner_id',
                    header: 'Owner',
                    minWidth: 110,
                    render: d => users.find(u => u.id === (d as unknown as Deal).owner_id)?.name ?? '—',
                  },
                  {
                    key: 'close_date',
                    header: 'Close',
                    width: 100,
                    render: d => new Date((d as unknown as Deal).close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  },
                  {
                    key: 'score',
                    header: 'Score',
                    width: 120,
                    render: d => {
                      const score = scoreMap.get((d as unknown as Deal).id);
                      if (!score) return null;
                      const meta = GRADE_META[score.grade];
                      return (
                        <span className="inline-flex items-center gap-1.5" title={`${meta.label} — ${score.score}/100`}>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            meta.tone === 'success' ? 'text-success bg-success-soft border-success/20'
                            : meta.tone === 'info' ? 'text-info bg-info-soft border-info/20'
                            : meta.tone === 'warning' ? 'text-warning bg-warning-soft border-warning/20'
                            : 'text-danger bg-danger-soft border-danger/20'
                          }`}>
                            <Sparkles className="w-2.5 h-2.5" />
                            {score.score}
                          </span>
                          <span className="text-2xs text-theme-secondary">{meta.label}</span>
                        </span>
                      );
                    },
                  },
                ]}
              />
            </div>
          </div>
        )}

        {/* VIEW: REVENUE FORECASTING */}
        {viewType === 'forecast' && (
          <div className="flex-1 p-5 overflow-y-auto bg-theme-base text-left space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Weighted Financial Pipeline Rollup</h4>
              <p className="text-[11px] text-theme-secondary mt-1">
                Expected revenue powered by Boutinly Intelligence API. Forecast is computed server-side from pipeline data, stage probabilities, and historical win rates.
              </p>
            </div>

            {forecastLoading ? (
              <div className="text-center py-8 text-xs text-theme-secondary/70 font-sans">
                <Clock className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p>Loading forecast from Boutinly Intelligence…</p>
              </div>
            ) : null}
            {!forecastLoading && displayForecast && filteredDeals.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-theme-card p-4 rounded-xl border border-theme-border shadow-2xs">
                  <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">Expected Revenue</span>
                  <span className="text-lg font-bold text-theme-accent font-sans tnum">${displayForecast.expected_revenue.toLocaleString()}</span>
                </div>
                <div className="bg-theme-card p-4 rounded-xl border border-theme-border shadow-2xs">
                  <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">Best Case</span>
                  <span className="text-lg font-bold text-success font-sans tnum">${displayForecast.best_case.toLocaleString()}</span>
                </div>
                <div className="bg-theme-card p-4 rounded-xl border border-theme-border shadow-2xs">
                  <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">Worst Case</span>
                  <span className="text-lg font-bold text-danger font-sans tnum">${displayForecast.worst_case.toLocaleString()}</span>
                </div>
                <div className="bg-theme-card p-4 rounded-xl border border-theme-border shadow-2xs">
                  <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">Confidence</span>
                  <span className="text-lg font-bold text-theme-primary font-sans tnum">{displayForecast.confidence}%</span>
                  <span className="text-[10px] text-theme-secondary block mt-0.5 font-sans">
                    {forecastIsClientSide
                      ? 'Locally estimated from stage probabilities.'
                      : 'Model confidence in the expected revenue projection.'}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4 font-sans text-xs">
              {filteredDeals.length === 0 ? (
                <div className="text-center py-8 text-xs text-theme-secondary/70 font-sans">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 text-theme-secondary/30" />
                  <p className="font-semibold text-theme-secondary">No opportunities to forecast</p>
                  <p className="mt-1">Forecast data will populate once opportunities are created in the pipeline.</p>
                </div>
              ) : (
                forecastMonths.map(month => {
                const monthDeals = filteredDeals.filter(d => {
                  const dealMonth = new Date(d.close_date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                  return dealMonth === month;
                });

                const totalRawValue = monthDeals.reduce((sum, d) => sum + d.value, 0);
                // Prefer API by_month forecast data; fall back to client-side
                // stage-probability weighting only when the API is unreachable.
                const apiMonthWeighted = forecastData?.by_month?.[month];
                const hasApiMonthData = apiMonthWeighted != null;
                const totalWeightedValue = hasApiMonthData
                  ? apiMonthWeighted
                  : monthDeals.reduce((sum, d) => {
                      const stageProb = stages.find(s => s.id === d.stage_id)?.probability || 0;
                      const prob = d.probability !== undefined ? d.probability : stageProb;
                      return sum + (d.value * (prob / 100));
                    }, 0);

                return (
                  <div key={month} className="bg-theme-card p-4 rounded-xl border border-theme-border shadow-2xs space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-theme-primary">{month}</span>
                      <span className="bg-theme-accent/10 text-theme-accent px-2 py-0.5 rounded text-[10px] font-bold font-sans">
                        {monthDeals.length} Opportunities
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-theme-border pt-3">
                      <div>
                        <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">Unweighted Gross Pipeline</span>
                        <span className="text-base font-bold text-theme-primary font-sans">${totalRawValue.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-sans text-theme-secondary block font-bold">
                          Expected Weighted Revenue
                          {hasApiMonthData ? null : (
                            <span className="text-warning font-normal ml-1" title="Computed from stage probabilities — API forecast is unavailable">(estimate)</span>
                          )}
                        </span>
                        <span className="text-base font-bold text-theme-accent font-sans">${totalWeightedValue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>
        )}

      </div>


      {/* RIGHT COLUMN: DEAL DETAIL VIEW PANEL */}
      <div className={`${selectedDealId ? 'flex' : 'hidden lg:flex'} w-full lg:w-1/2 min-w-0 flex-col bg-theme-base h-full overflow-hidden select-none print-area`}>
        {activeDeal ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden text-left">
            
            {/* Header profile block */}
            <div className="bg-theme-card p-4 sm:p-5 border-b border-theme-border shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDealId(null)}
                className="lg:hidden mb-3 text-xs font-semibold text-theme-accent hover:text-theme-accent-strong cursor-pointer bg-transparent border-none px-0"
              >
                ← Back to list
              </button>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-theme-accent/10 text-theme-accent rounded-xl shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-theme-primary truncate">{activeDeal.name}</h3>
                    <p className="text-xs text-theme-secondary truncate">
                      Company: <strong className="text-theme-primary">{accounts.find(a => a.id === activeDeal.account_id)?.name || 'Unassigned'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isReadOnly && (
                    <button
                      onClick={() => setConfirmDeleteDealId(activeDeal.id)}
                      className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-colors cursor-pointer bg-transparent border-none"
                      aria-label={`Delete deal ${activeDeal.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={printRecord}
                    className="p-1.5 text-theme-secondary hover:text-theme-primary rounded-md hover:bg-theme-hover transition-colors cursor-pointer bg-transparent border-none"
                    aria-label={`Print or save ${activeDeal.name} as PDF`}
                    title="Print / Save as PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFullDealDetail(activeDeal.id)}
                    className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-colors cursor-pointer bg-transparent border-none"
                    aria-label={`View full record for ${activeDeal.name}`}
                    title="View Full Record"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Core Attributes */}
              <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-theme-border text-[11px] text-theme-secondary font-sans">
                <div>
                  <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase tracking-wider font-semibold">Opportunity Value</span>
                  <span className="text-sm font-semibold tnum text-theme-primary font-sans">${activeDeal.value.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase tracking-wider font-semibold">Pipeline Stage</span>
                  <span className="text-xs font-bold text-theme-primary block truncate mt-1">
                    {stages.find(s => s.id === activeDeal.stage_id)?.name || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase tracking-wider font-semibold">
                    {stages.find(s => s.id === activeDeal.stage_id)?.type !== 'open' ? 'Closed On' : 'Expected Close'}
                  </span>
                  <span
                    className={`text-xs font-bold block mt-1 ${
                      (() => {
                        if (stages.find(s => s.id === activeDeal.stage_id)?.type !== 'open') return 'text-theme-primary';
                        const rel = relativeDueLabel(activeDeal.close_date, currentUser?.timezone);
                        return rel.tone === 'overdue' ? 'text-danger' : rel.tone === 'soon' ? 'text-warning' : 'text-theme-primary';
                      })()
                    }`}
                    title={formatDateTime(activeDeal.close_date, currentUser?.timezone)}
                  >
                    {new Date(activeDeal.close_date).toLocaleDateString()}
                    <span className="block text-[9px] font-medium text-theme-secondary normal-case">
                      {stages.find(s => s.id === activeDeal.stage_id)?.type !== 'open'
                        ? (stages.find(s => s.id === activeDeal.stage_id)?.type === 'won' ? 'Won' : 'Lost')
                        : relativeDueLabel(activeDeal.close_date, currentUser?.timezone).text}
                    </span>
                  </span>
                </div>
              </div>

              {/* Stage Transition Control Bar */}
              {!isReadOnly && (
                <div className="mt-5 bg-theme-base/50 p-2.5 rounded-lg border border-theme-border flex items-center justify-between gap-1 text-[11px]">
                  <span className="font-semibold text-theme-secondary">Change Opportunity State:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => triggerCloseDeal('won')}
                      className="bg-theme-accent/15 text-theme-primary border border-theme-accent/20 hover:opacity-90 font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer text-[10px] uppercase tracking-wider font-sans"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-theme-accent" /> Won
                    </button>
                    <button
                      onClick={() => triggerCloseDeal('lost')}
                      className="bg-theme-secondary/15 text-theme-secondary border border-theme-border hover:opacity-90 font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer text-[10px] uppercase tracking-wider font-sans"
                    >
                      <XCircle className="w-3.5 h-3.5 text-theme-secondary" /> Lost
                    </button>
                    
                    {/* Next normal stage dropdown */}
                    <select
                      value={activeDeal.stage_id}
                      onChange={(e) => moveDealStage(activeDeal.id, e.target.value)}
                      className="bg-theme-card text-theme-primary border border-theme-border rounded px-1.5 py-0.5 font-medium cursor-pointer focus:outline-none"
                    >
                      {activeStages.map(stg => <option key={stg.id} value={stg.id} className="bg-theme-card text-theme-primary">{stg.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Dynamic custom fields value display */}
              {customFields.filter(f => f.entity_type === 'deal' && f.is_visible).length > 0 && (
                <div className="mt-4 border-t border-theme-border pt-3 text-[11px]">
                  <h5 className="text-[9px] uppercase font-bold text-theme-secondary font-sans tracking-wider">Dynamic Fields</h5>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {customFields.filter(f => f.entity_type === 'deal' && f.is_visible).map(f => (
                      <div key={f.id} className="p-2 bg-theme-base/50 rounded border border-theme-border">
                        <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase">{f.label}</span>
                        <span className="font-semibold text-theme-primary">
                          {activeDeal.custom_fields[f.key]?.toString() || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Split panels: PRODUCTS & ATTACHMENTS */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-theme-base">

              {/* Boutinly Intelligence: explainable deal score (API-driven) */}
              {scoresLoading && !scoreMap.has(activeDeal.id) ? (
                <div className="bg-theme-card rounded-xl border border-theme-border p-4 space-y-3 shadow-2xs text-center">
                  <p className="text-xs text-theme-secondary/70 font-sans">Loading Boutinly score…</p>
                </div>
              ) : (() => {
                const score = scoreMap.get(activeDeal.id);
                if (!score) return null;
                const meta = GRADE_META[score.grade];
                const toneClasses = {
                  success: 'text-success bg-success-soft border-success/20',
                  info: 'text-info bg-info-soft border-info/20',
                  warning: 'text-warning bg-warning-soft border-warning/20',
                  danger: 'text-danger bg-danger-soft border-danger/20',
                }[meta.tone];
                const barTone = {
                  success: 'bg-success',
                  info: 'bg-info',
                  warning: 'bg-warning',
                  danger: 'bg-danger',
                }[meta.tone];
                return (
                  <div className="bg-theme-card rounded-xl border border-theme-border p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-theme-accent" /> Boutinly Score
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClasses}`}>
                          {meta.label} · {score.score}/100
                        </span>
                        <button
                          onClick={handleRefreshScore}
                          disabled={scoreRefreshing}
                          className="text-[10px] font-semibold text-theme-accent hover:opacity-80 disabled:opacity-50 cursor-pointer bg-transparent border border-theme-border rounded px-1.5 py-0.5 hover:bg-theme-hover transition-colors"
                          title="Re-fetch score from API"
                        >
                          {scoreRefreshing ? 'Refreshing…' : 'Refresh Score'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="h-1.5 w-full bg-theme-inset rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barTone}`} style={{ width: `${score.score}%` }} />
                      </div>
                      <p className="text-[10px] text-theme-secondary mt-1.5 font-sans">
                        API-driven model · stage momentum, engagement, value, and record completeness. Confidence: {score.confidence}%.
                      </p>
                    </div>

                    <div className="divide-y divide-theme-border rounded-lg border border-theme-border overflow-hidden">
                      {score.factors.map(factor => (
                        <div key={factor.key} className="px-3 py-2 flex items-start justify-between gap-3 bg-theme-base/30">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-theme-primary">{factor.label}</p>
                            <p className="text-[10px] text-theme-secondary mt-0.5 leading-relaxed">{factor.detail}</p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                              factor.impact > 0 ? 'text-success bg-success-soft' : factor.impact < 0 ? 'text-danger bg-danger-soft' : 'text-theme-secondary bg-theme-inset'
                            }`}
                          >
                            {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-theme-secondary/80 font-sans leading-relaxed">
                      Scores are fetched from the Boutinly Intelligence API and recomputed server-side from CRM data.
                      Use them to prioritize follow-ups — they do not replace sales judgment.
                    </p>
                  </div>
                );
              })()}

              {/* Card Section: Products & Line Items */}
              <div className="bg-theme-card rounded-xl border border-theme-border p-4 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-theme-secondary" /> Products Catalog & Line Items
                  </h4>
                  {!isReadOnly && (
                    <button
                      onClick={() => setShowLineItemForm(!showLineItemForm)}
                      className="text-[11px] text-theme-accent hover:opacity-80 font-semibold flex items-center gap-0.5 cursor-pointer bg-transparent border-none"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  )}
                </div>

                {/* Inline form to add line items */}
                {showLineItemForm && (
                  <form onSubmit={handleAddLineItem} className="p-3 bg-theme-base rounded-lg border border-theme-border space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block font-semibold text-theme-secondary">Product Name</label>
                        <input
                          type="text" required
                          value={lineItemForm.product_name}
                          onChange={(e) => setLineItemForm({ ...lineItemForm, product_name: e.target.value })}
                          className="w-full bg-theme-card text-theme-primary border border-theme-border rounded px-2.5 py-1"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="block font-semibold text-theme-secondary">Qty</label>
                          <input
                            type="number" required min="1"
                            value={lineItemForm.quantity}
                            onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: Number(e.target.value) })}
                            className="w-full bg-theme-card text-theme-primary border border-theme-border rounded px-2 py-1"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="block font-semibold text-theme-secondary">Price ($)</label>
                          <input
                            type="number" required min="0"
                            value={lineItemForm.unit_price}
                            onChange={(e) => setLineItemForm({ ...lineItemForm, unit_price: Number(e.target.value) })}
                            className="w-full bg-theme-card text-theme-primary border border-theme-border rounded px-2 py-1"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLineItemForm(false)}
                        className="px-3 py-1 border border-theme-border rounded hover:bg-theme-base text-[11px] text-theme-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-theme-accent hover:opacity-90 text-white font-semibold px-3 py-1 rounded text-[11px]"
                      >
                        Add to Deal
                      </button>
                    </div>
                  </form>
                )}

                {/* Line items list */}
                <div className="divide-y divide-theme-border text-xs">
                  {activeDeal.line_items.length === 0 ? (
                    <p className="text-center text-xs text-theme-secondary/70 py-4 font-sans">No product items added. Add one above to populate line total aggregates.</p>
                  ) : (
                    activeDeal.line_items.map(item => (
                      <div key={item.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-theme-primary">{item.product_name}</p>
                          <p className="text-[10px] text-theme-secondary mt-0.5">
                            {item.quantity} units × ${item.unit_price.toLocaleString()} 
                            {item.discount_pct > 0 && ` (Less ${item.discount_pct}% discount)`}
                          </p>
                        </div>
                        <span className="font-bold text-theme-primary font-sans">${item.total.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                  {activeDeal.line_items.length > 0 && (
                    <div className="pt-3 flex justify-between font-bold text-theme-primary">
                      <span>Total Value Aggregated</span>
                      <span className="font-sans text-theme-accent">${activeDeal.value.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Section: S3 File Attachments */}
              <div className="bg-theme-card rounded-xl border border-theme-border p-4 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-theme-secondary" /> S3 Vault Document Attachments
                  </h4>
                  {!isReadOnly && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                        onChange={handleFileUpload}
                        className="hidden"
                        aria-label="Upload attachment"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="text-[11px] text-theme-accent hover:opacity-80 font-semibold flex items-center gap-0.5 cursor-pointer bg-transparent border-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" /> Uploading…
                          </span>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Upload File
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {filesLoading ? (
                  <p className="text-center text-xs text-theme-secondary/70 py-3 font-sans">Loading attachments…</p>
                ) : dealFiles.length === 0 ? (
                  <p className="text-center text-xs text-theme-secondary/70 py-3 font-sans">No attachments yet. Upload a PDF, document, or image.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {dealFiles.map(file => (
                      <div key={file.id} className="p-2.5 bg-theme-base/30 rounded-lg border border-theme-border flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-4 h-4 text-theme-secondary shrink-0" />
                          <span className="font-semibold text-theme-primary truncate">{file.filename}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[10px] text-theme-secondary/80 font-sans font-medium">{formatFileSize(file.size_bytes)}</span>
                          <button
                            onClick={() => handleDownloadFile(file.id, file.filename)}
                            className="p-0.5 text-theme-secondary hover:text-theme-accent rounded transition-colors cursor-pointer bg-transparent border-none"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-0.5 text-theme-secondary hover:text-danger rounded transition-colors cursor-pointer bg-transparent border-none"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <p className="p-8 text-center text-xs text-theme-secondary/70 font-sans">Select a deal to inspect line items, stages, files, and forecasts.</p>
        )}
      </div>


      {/* MODAL: CREATE DEAL */}
      {showCreateDeal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Provision New Opportunity</h3>
              <button onClick={() => setShowCreateDeal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleCreateDealSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Opportunity Name *</label>
                <input
                  type="text" required placeholder="e.g. Boutinly Software License"
                  value={dealForm.name}
                  onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Target Value (USD) *</label>
                  <input
                    type="number" required
                    value={dealForm.value}
                    onChange={(e) => setDealForm({ ...dealForm, value: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Target Close Date *</label>
                  <input
                    type="date" required
                    value={dealForm.close_date}
                    onChange={(e) => setDealForm({ ...dealForm, close_date: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Company Account Association *</label>
                  <select
                    required
                    value={dealForm.account_id}
                    onChange={(e) => setDealForm({ ...dealForm, account_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="">-- Select Company --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Assigned Sales Rep *</label>
                  <select
                    required
                    value={dealForm.owner_id}
                    onChange={(e) => setDealForm({ ...dealForm, owner_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Starting Pipeline Stage</label>
                <select
                  value={dealForm.stage_id}
                  onChange={(e) => setDealForm({ ...dealForm, stage_id: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                >
                  {activeStages.map(stg => <option key={stg.id} value={stg.id}>{stg.name} ({stg.probability}% win probability)</option>)}
                </select>
              </div>

              {/* Dynamic inputs for admin custom fields */}
              {customFields.filter(f => f.entity_type === 'deal').map(f => (
                <div key={f.id} className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">{f.label}</label>
                  <input
                    type="text"
                    onChange={(e) => setDealForm({
                      ...dealForm,
                      custom_values: { ...dealForm.custom_values, [f.key]: e.target.value }
                    })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              ))}

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDeal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: CLOSE DEAL OUTCOME */}
      {showCloseDealModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Close Opportunity (Final Status)</h3>
              <button onClick={() => setShowCloseDealModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <div className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <p className="text-theme-secondary leading-normal">
                Setting this deal to Closed {closingOutcome === 'won' ? 'Won' : 'Lost'}.
              </p>

              {closingOutcome === 'lost' && (
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Reason for Loss *</label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="Price too high" className="bg-theme-card text-theme-primary">Price too high / Budget deficit</option>
                    <option value="Lost to competitor" className="bg-theme-card text-theme-primary">Lost to competitor product</option>
                    <option value="Feature deficit" className="bg-theme-card text-theme-primary">Feature deficit</option>
                    <option value="Sponsor churn" className="bg-theme-card text-theme-primary">Executive sponsor churn</option>
                    <option value="Project postponed" className="bg-theme-card text-theme-primary">Project postponed indefinitely</option>
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  onClick={() => setShowCloseDealModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseDealConfirm}
                  className={`px-4 py-2 text-white rounded-lg font-semibold cursor-pointer ${
                    closingOutcome === 'won' ? 'bg-theme-accent hover:opacity-90' : 'bg-theme-secondary/80 hover:opacity-90'
                  }`}
                >
                  Confirm Close {closingOutcome === 'won' ? 'Won' : 'Lost'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE DEAL */}
      <ConfirmDialog
        open={confirmDeleteDealId !== null}
        onCancel={() => setConfirmDeleteDealId(null)}
        onConfirm={() => {
          if (confirmDeleteDealId) {
            deleteDeal(confirmDeleteDealId);
            setSelectedDealId(null);
            toast.success('Deal deleted');
          }
          setConfirmDeleteDealId(null);
        }}
        title="Delete opportunity?"
        body="This permanently removes the opportunity and its history from the pipeline. This action cannot be undone."
        confirmLabel="Delete opportunity"
      />

    </div>
  );
}

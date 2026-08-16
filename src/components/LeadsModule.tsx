/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../store';
import { Lead, LeadStatus, UserRole } from '../types';
import {
  Button, Input, Select, Modal, ConfirmDialog, Badge, EmptyState, Avatar, Textarea, TimelinePanel, toast,
} from './ui';
import {
  Search, Plus, Pencil, Trash2, Mail, ChevronRight, LayoutGrid, List,
  Download, Sparkles, ArrowLeft, Building2, CheckCircle2, UserPlus, Phone,
} from 'lucide-react';
import { exportCsv } from '../utils/exportCsv';
import { formatDateTime } from '../utils/time';
import { NEW_RECORD_EVENT, SELECT_ENTITY_EVENT, dispatchSelectEntity, type SelectEntityDetail } from './GlobalShortcuts';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const STATUS_ORDER: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'unqualified'];

const STATUS_META: Record<LeadStatus, { label: string; description: string; tone: BadgeTone; fill: string }> = {
  new: { label: 'New', description: 'Untouched', tone: 'info', fill: 'bg-info text-white' },
  working: { label: 'Working', description: 'Active outreach', tone: 'warning', fill: 'bg-warning text-white' },
  nurturing: { label: 'Nurturing', description: 'On hold', tone: 'accent', fill: 'bg-theme-accent text-white' },
  qualified: { label: 'Qualified', description: 'Ready to convert', tone: 'success', fill: 'bg-success text-white' },
  unqualified: { label: 'Unqualified', description: 'Dead lead', tone: 'danger', fill: 'bg-danger text-white' },
  converted: { label: 'Converted', description: 'Moved to Accounts', tone: 'success', fill: 'bg-success text-white' },
};

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }));

const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface EditCtx {
  value: string;
  setValue: (v: string) => void;
  commit: () => void;
  cancel: () => void;
  busy: boolean;
}

function FieldEditor({ ctx, editor, options, placeholder }: {
  ctx: EditCtx;
  editor: 'text' | 'email' | 'select';
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  // Inline height/background beat the global input rule in index.css, which
  // would otherwise override Tailwind's h-8 / bg-theme-base utilities.
  const cls = 'w-full text-xs border border-theme-accent/50 rounded-md text-theme-primary font-sans outline-none focus:ring-2 focus:ring-theme-accent/30';
  const style = { height: 32, background: 'var(--bg-base)' } as const;
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); ctx.commit(); }
    if (e.key === 'Escape') { e.preventDefault(); ctx.cancel(); }
  };

  if (editor === 'select') {
    return (
      <select
        autoFocus
        className={`${cls} cursor-pointer`}
        style={style}
        value={ctx.value}
        onChange={e => ctx.setValue(e.target.value)}
        onBlur={ctx.commit}
        onKeyDown={keyDown}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={editor === 'email' ? 'email' : 'text'}
      className={cls}
      style={style}
      value={ctx.value}
      onChange={e => ctx.setValue(e.target.value)}
      onBlur={ctx.commit}
      onKeyDown={keyDown}
    />
  );
}

function InlineEditable({ label, display, initialValue, onCommit, editable = true, editor = 'text', options = [], placeholder = '' }: {
  label: string;
  display: React.ReactNode;
  initialValue: string;
  onCommit: (value: string) => Promise<boolean> | boolean;
  editable?: boolean;
  editor?: 'text' | 'email' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(initialValue);
  }, [initialValue, editing]);

  const start = () => { if (editable) { setDraft(initialValue); setEditing(true); } };
  const cancel = () => setEditing(false);
  const commit = async () => {
    if (busy) return;
    if (draft === initialValue) { setEditing(false); return; }
    setBusy(true);
    try {
      const ok = await onCommit(draft);
      if (ok) setEditing(false);
    } finally { setBusy(false); }
  };

  const ctx: EditCtx = { value: draft, setValue: setDraft, commit, cancel, busy };

  return (
    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">{label}</span>
      {editing ? (
        <FieldEditor ctx={ctx} editor={editor} options={options} placeholder={placeholder} />
      ) : editable ? (
        <button
          onClick={start}
          className="group flex w-full items-center justify-between gap-2 text-left cursor-pointer bg-transparent border-none p-0"
          title={`Edit ${label}`}
        >
          <span className="text-xs text-theme-primary font-sans min-w-0 break-words">{display}</span>
          <Pencil className="w-3 h-3 text-theme-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ) : (
        <div className="text-xs text-theme-primary font-sans min-w-0 break-words">{display}</div>
      )}
    </div>
  );
}

export default function LeadsModule() {
  const {
    currentUser,
    users,
    leads,
    accounts,
    contacts,
    deals,
    getScopedLeads,
    addLead,
    updateLead,
    deleteLead,
    convertLead,
    addActivity,
    setActiveModule,
  } = useCRM();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_name: '', email: '', phone: '', source: '',
    status: 'new' as LeadStatus, owner_id: '',
  });

  // "n" shortcut → open the create modal
  useEffect(() => {
    const onNewRecord = () => setShowCreate(true);
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, []);

  // Deep-link from AI next-best-action → select the lead
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'leads') return;
      setSelectedLeadId(detail.entityId);
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);

  const scopedLeads = getScopedLeads();
  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    // Active list — converted leads stay archived (historical) and are hidden.
    let list = scopedLeads.filter(l => !l.is_converted);
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(l =>
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.company_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.source || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [scopedLeads, statusFilter, searchQuery]);

  const activeLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) ?? null : null;

  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const canEdit = !isReadOnly && activeLead?.status !== 'converted' &&
    (currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER || currentUser?.id === activeLead?.owner_id);

  const ownerName = (id?: string) => usersById.get(id || '')?.name || 'Unassigned';
  const fullName = (l: Lead) => `${l.first_name} ${l.last_name}`.trim();

  const openCreate = () => {
    setForm({ first_name: '', last_name: '', company_name: '', email: '', phone: '', source: '', status: 'new', owner_id: currentUser?.id || '' });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!form.first_name.trim()) { toast.error('First name is required'); return; }
    if (!form.last_name.trim()) { toast.error('Last name is required'); return; }
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!EMAIL_RE.test(form.email.trim())) { toast.error('Enter a valid email address'); return; }
    await addLead({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      company_name: form.company_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      status: form.status,
      owner_id: form.owner_id,
    });
    setShowCreate(false);
  };

  const confirmDelete = async () => {
    if (!activeLead) return;
    await deleteLead(activeLead.id);
    setShowDelete(false);
    setSelectedLeadId(null);
  };

  const saveField = async (field: 'first_name' | 'last_name' | 'company_name' | 'email' | 'phone' | 'source' | 'owner_id', value: string): Promise<boolean> => {
    if (!activeLead || !canEdit) return false;
    if ((field === 'first_name' || field === 'last_name') && !value.trim()) { toast.error('Name is required'); return false; }
    if (field === 'company_name' && !value.trim()) { toast.error('Company name is required'); return false; }
    if (field === 'email') {
      if (!value.trim()) { toast.error('Email is required'); return false; }
      if (!EMAIL_RE.test(value.trim())) { toast.error('Enter a valid email address'); return false; }
    }
    const patch: Partial<Lead> = {};
    if (field === 'first_name') patch.first_name = value.trim();
    if (field === 'last_name') patch.last_name = value.trim();
    if (field === 'company_name') patch.company_name = value.trim();
    if (field === 'email') patch.email = value.trim();
    if (field === 'phone') patch.phone = value.trim();
    if (field === 'source') patch.source = value.trim();
    if (field === 'owner_id') patch.owner_id = value;
    return await updateLead(activeLead.id, patch);
  };

  const setLeadStatus = async (next: LeadStatus): Promise<boolean> => {
    if (!activeLead || activeLead.status === next || !canEdit) return false;
    const prev = activeLead.status;
    const ok = await updateLead(activeLead.id, { status: next });
    if (ok) {
      await addActivity({
        type: 'stage_change',
        title: `Lead status changed`,
        body: `Moved from ${STATUS_META[prev].label} to ${STATUS_META[next].label}.`,
        user_id: currentUser?.id || '',
        lead_id: activeLead.id,
      });
    }
    return ok;
  };

  const handleCsvExport = () => {
    exportCsv(`boutinly-leads-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'company_name', header: 'Company Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone', format: (l: Lead) => l.phone || '' },
      { key: 'source', header: 'Source', format: (l: Lead) => l.source || '' },
      { key: 'status', header: 'Status', format: (l: Lead) => STATUS_META[l.status].label },
      { key: 'owner', header: 'Owner', format: (l: Lead) => ownerName(l.owner_id) },
    ]);
  };

  const onConvert = async (payload: Record<string, unknown>) => {
    if (!activeLead) return;
    const ok = await convertLead(activeLead.id, payload);
    if (ok) setShowConvert(false);
  };

  if (activeLead) {
    const convertedAccount = activeLead.converted_account_id ? accounts.find(a => a.id === activeLead.converted_account_id) : null;
    const convertedContact = activeLead.converted_contact_id ? contacts.find(c => c.id === activeLead.converted_contact_id) : null;
    const convertedOpportunity = activeLead.converted_account_id
      ? deals.find(d => d.account_id === activeLead.converted_account_id && d.name.includes('Default Opportunity'))
      : null;
    const isConverted = activeLead.is_converted || activeLead.status === 'converted';
    const activeIdx = STATUS_ORDER.indexOf(activeLead.status);
    const statusOptions = LEAD_STATUSES.map(s => ({ value: s.value, label: s.label }));

    const openConvertedAccount = (accountId: string) => {
      setActiveModule('accounts');
      // Re-dispatch after the module mounts so AccountsModule picks it up
      setTimeout(() => dispatchSelectEntity({ module: 'accounts', entityId: accountId }), 100);
    };

    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
          {/* Header — breadcrumb, status path tracker, title + quick actions */}
          <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
            {/* Breadcrumb Trail */}
            <nav className="flex items-center gap-1.5 text-2xs text-theme-secondary font-sans min-w-0" aria-label="Breadcrumb">
              <button
                onClick={() => setSelectedLeadId(null)}
                className="flex items-center gap-1 text-theme-secondary hover:text-theme-accent cursor-pointer bg-transparent border-none p-0 font-medium transition-colors"
              >
                <UserPlus className="w-3 h-3" /> Leads
              </button>
              <ChevronRight className="w-3 h-3 shrink-0 text-theme-secondary/50" />
              <span className="text-theme-primary font-semibold truncate">{fullName(activeLead)}</span>
            </nav>

            {/* Status Path Tracker */}
            <div className="mt-4">
              <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-2">Lead Status Path</span>
              <div className="flex items-stretch w-full" role="group" aria-label="Lead status path">
                {STATUS_ORDER.map((s, i) => {
                  const isCurrent = activeIdx === i;
                  const isDone = activeIdx > i;
                  const stateCls = isConverted ? 'bg-success-soft text-success'
                    : isCurrent ? STATUS_META[s].fill
                    : isDone ? 'bg-success-soft text-success'
                    : 'bg-theme-inset text-theme-secondary';
                  return (
                    <button
                      key={s}
                      onClick={() => setLeadStatus(s)}
                      disabled={!canEdit}
                      title={`${STATUS_META[s].label} — ${STATUS_META[s].description}${isCurrent ? ' (current)' : ' (click to set)'}`}
                      aria-label={`Set lead status to ${STATUS_META[s].label}`}
                      className={`flex-1 min-w-0 px-3 py-2 text-center font-sans text-2xs font-semibold cursor-pointer border-none transition-colors disabled:cursor-not-allowed ${stateCls} ${i > 0 ? '' : 'rounded-l-md'} ${i === STATUS_ORDER.length - 1 ? 'rounded-r-md' : ''}`}
                      style={{
                        clipPath: i > 0 && i < STATUS_ORDER.length - 1
                          ? 'polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)'
                          : i === 0
                            ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                            : 'polygon(12px 0, 100% 0, 100% 50%, 100% 100%, 12px 100%, 0 50%)',
                        marginLeft: i > 0 ? -12 : 0,
                        position: 'relative',
                        zIndex: i + 1,
                      }}
                    >
                      {isCurrent && <span className="sr-only">Current: </span>}
                      {STATUS_META[s].label}
                    </button>
                  );
                })}
                {isConverted && (
                  <span
                    aria-label="Converted"
                    className="flex-1 min-w-0 px-3 py-2 text-center font-sans text-2xs font-semibold bg-success text-white rounded-r-md"
                    style={{ clipPath: 'polygon(12px 0, 100% 0, 100% 50%, 100% 100%, 12px 100%, 0 50%)', marginLeft: -12, position: 'relative', zIndex: STATUS_ORDER.length + 1 }}
                  >
                    <span className="inline-flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Converted</span>
                  </span>
                )}
              </div>
            </div>

            {/* Title + quick actions */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setSelectedLeadId(null)}
                className="p-1 -ml-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Avatar name={fullName(activeLead)} size="lg" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-theme-primary font-display truncate">{fullName(activeLead)}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge tone={STATUS_META[activeLead.status].tone}>{STATUS_META[activeLead.status].label}</Badge>
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary font-sans">
                    <Building2 className="w-3 h-3" /> {activeLead.company_name}
                  </span>
                  {activeLead.email && (
                    <span className="flex items-center gap-1.5 text-xs text-theme-secondary font-sans">
                      <Mail className="w-3 h-3" /> {activeLead.email}
                    </span>
                  )}
                </div>
              </div>
              {/* Quick Actions — Convert is the prioritized primary action */}
              <div className="flex items-center gap-2 shrink-0">
                {!isConverted && canEdit && (
                  <Button
                    size="md"
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                    disabled={activeLead.status !== 'qualified'}
                    title={activeLead.status === 'qualified' ? 'Convert this lead into an account and contact' : 'Set the lead status to Qualified to convert'}
                    onClick={() => setShowConvert(true)}
                    className="min-w-[110px]"
                  >
                    Convert
                  </Button>
                )}
                {isConverted && (
                  <Badge tone="success">
                    <CheckCircle2 className="w-3 h-3" /> Converted
                  </Badge>
                )}
                {!isConverted && canEdit && (
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setShowDelete(true)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Body — left details grid, right activity timeline sidebar */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
              {/* Left column — Details (two-column grid, inline editable) */}
              <div className="flex-1 min-w-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Lead ID</span>
                      <span className="text-xs text-theme-primary font-sans break-all">{activeLead.id}</span>
                    </div>
                    <InlineEditable
                      label="First Name"
                      display={activeLead.first_name}
                      initialValue={activeLead.first_name}
                      editable={canEdit}
                      onCommit={v => saveField('first_name', v)}
                    />
                    <InlineEditable
                      label="Last Name"
                      display={activeLead.last_name}
                      initialValue={activeLead.last_name}
                      editable={canEdit}
                      onCommit={v => saveField('last_name', v)}
                    />
                    <InlineEditable
                      label="Company Name"
                      display={activeLead.company_name}
                      initialValue={activeLead.company_name}
                      editable={canEdit}
                      onCommit={v => saveField('company_name', v)}
                    />
                    <InlineEditable
                      label="Email"
                      display={activeLead.email ? (
                        canEdit ? (
                          <span className="break-all">{activeLead.email}</span>
                        ) : (
                          <a className="text-theme-accent hover:underline break-all" href={`mailto:${activeLead.email}`}>{activeLead.email}</a>
                        )
                      ) : '—'}
                      initialValue={activeLead.email}
                      editable={canEdit}
                      editor="email"
                      onCommit={v => saveField('email', v)}
                    />
                    <InlineEditable
                      label="Phone"
                      display={activeLead.phone || '—'}
                      initialValue={activeLead.phone || ''}
                      editable={canEdit}
                      onCommit={v => saveField('phone', v)}
                    />
                    <InlineEditable
                      label="Source"
                      display={activeLead.source || '—'}
                      initialValue={activeLead.source || ''}
                      editable={canEdit}
                      onCommit={v => saveField('source', v)}
                    />
                    <InlineEditable
                      label="Status"
                      display={<Badge tone={STATUS_META[activeLead.status].tone}>{STATUS_META[activeLead.status].label}</Badge>}
                      initialValue={activeLead.status}
                      editable={canEdit}
                      editor="select"
                      options={statusOptions}
                      placeholder="Select status"
                      onCommit={v => setLeadStatus(v as LeadStatus)}
                    />
                    <InlineEditable
                      label="Owner"
                      display={ownerName(activeLead.owner_id)}
                      initialValue={activeLead.owner_id}
                      editable={canEdit}
                      editor="select"
                      options={users.map(u => ({ value: u.id, label: u.name }))}
                      placeholder="Select owner"
                      onCommit={v => saveField('owner_id', v)}
                    />
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Created At</span>
                      <span className="text-xs text-theme-primary font-sans">{formatDateTime(activeLead.created_at, currentUser?.timezone)}</span>
                    </div>
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Updated At</span>
                      <span className="text-xs text-theme-primary font-sans">{activeLead.updated_at ? formatDateTime(activeLead.updated_at, currentUser?.timezone) : '—'}</span>
                    </div>
                    {isConverted && (
                      <div className="sm:col-span-2 px-4 py-3 border border-success/30 rounded-lg bg-success-soft min-w-0">
                        <span className="block text-2xs font-medium text-success uppercase tracking-wider font-sans mb-1">Conversion</span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-primary font-sans">
                          {convertedAccount && (
                            <button
                              onClick={() => openConvertedAccount(convertedAccount.id)}
                              className="inline-flex items-center gap-1.5 text-theme-accent hover:underline cursor-pointer bg-transparent border-none p-0 font-medium"
                            >
                              <Building2 className="w-3 h-3" /> {convertedAccount.name}
                            </button>
                          )}
                          {convertedContact && (
                            <span>· Contact: {convertedContact.first_name} {convertedContact.last_name}</span>
                          )}
                          {convertedOpportunity && (
                            <button
                              onClick={() => { setActiveModule('deals'); setTimeout(() => dispatchSelectEntity({ module: 'deals', entityId: convertedOpportunity.id }), 100); }}
                              className="inline-flex items-center gap-1.5 text-theme-accent hover:underline cursor-pointer bg-transparent border-none p-0 font-medium"
                              title="Open opportunity"
                            >
                              · Opportunity: {convertedOpportunity.name}
                            </button>
                          )}
                          {activeLead.converted_at && (
                            <span className="text-theme-secondary">· {formatDateTime(activeLead.converted_at, currentUser?.timezone)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column — Related Lists Sidebar (lead-specific activity timeline) */}
              <div className="w-full lg:w-[360px] shrink-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Activity Timeline</h3>
                  <TimelinePanel entityType="lead" entityId={activeLead.id} readOnly={isReadOnly} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={showDelete}
          onCancel={() => setShowDelete(false)}
          onConfirm={confirmDelete}
          title="Delete lead"
          body={`This will permanently delete "${fullName(activeLead)}" from the staging area. This action cannot be undone.`}
          confirmLabel="Delete lead"
        />

        {showConvert && activeLead && activeLead.status === 'qualified' && (
          <ConvertLeadModal
            lead={activeLead}
            accounts={accounts}
            users={users}
            onCancel={() => setShowConvert(false)}
            onConvert={onConvert}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
      {/* Header */}
      <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-4 h-4 text-theme-accent" strokeWidth={2} />
            <h1 className="text-base font-semibold text-theme-primary font-sans tracking-tight">Leads</h1>
            <Badge tone="neutral">{filtered.length}</Badge>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 bg-theme-inset border border-theme-border rounded-lg p-0.5" role="tablist" aria-label="Filter by status">
            {[{ value: 'all' as const, label: 'All' }, ...LEAD_STATUSES].map(s => (
              <button
                key={s.value}
                role="tab"
                aria-selected={statusFilter === s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-2.5 h-7 text-2xs font-semibold rounded-md cursor-pointer border-none transition-colors ${
                  statusFilter === s.value ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search leads…"
              className="w-56 text-theme-primary text-xs border border-theme-border rounded-lg pl-8 pr-2.5 placeholder:text-theme-secondary/50"
              style={{ height: 36, paddingLeft: 32, background: 'var(--bg-inset)' }}
              aria-label="Search leads"
            />
          </div>
          <div className="flex items-center gap-1 bg-theme-inset border border-theme-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md cursor-pointer border-none ${viewMode === 'cards' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
              aria-label="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md cursor-pointer border-none ${viewMode === 'table' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
              aria-label="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleCsvExport}
            className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg cursor-pointer bg-transparent border-none"
            aria-label="Export leads to CSV"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <Button size="md" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
            New Lead
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-6 h-6" />}
            title="No leads found"
            body={searchQuery || statusFilter !== 'all' ? 'Try a different search or status filter.' : 'Capture your first lead in the staging area, nurture it to Qualified, then convert it into a clean account and contact.'}
            action={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>New Lead</Button>}
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(lead => (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="text-left bg-theme-card border border-theme-border rounded-xl p-4 shadow-card hover:shadow-raised hover:border-theme-accent/40 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-theme-primary font-sans truncate">{fullName(lead)}</h3>
                    <p className="text-2xs text-theme-secondary mt-0.5 truncate">{lead.company_name}</p>
                  </div>
                  <Badge tone={STATUS_META[lead.status].tone}>{STATUS_META[lead.status].label}</Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-2xs text-theme-secondary font-sans">
                  <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /> {lead.email}</p>
                  {lead.phone && <p className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3 shrink-0" /> {lead.phone}</p>}
                </div>
                <p className="mt-2.5 text-2xs text-theme-secondary/70 font-sans truncate">
                  {ownerName(lead.owner_id)}{lead.source ? ` · ${lead.source}` : ''}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-theme-card border border-theme-border rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-theme-inset text-left text-2xs font-semibold text-theme-secondary uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filtered.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className="hover:bg-theme-hover cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-theme-primary">{fullName(lead)}</td>
                    <td className="px-4 py-3 text-theme-secondary">{lead.company_name}</td>
                    <td className="px-4 py-3 text-theme-secondary">{lead.email}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_META[lead.status].tone}>{STATUS_META[lead.status].label}</Badge></td>
                    <td className="px-4 py-3 text-theme-secondary">{ownerName(lead.owner_id)}</td>
                    <td className="px-4 py-3 text-theme-secondary">{lead.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal
          open
          onClose={() => setShowCreate(false)}
          title="New Lead"
          subtitle="Raw, unverified prospect — captured in the staging area."
          width="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={submitCreate}>Save Lead</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jane" />
              <Input label="Last Name" required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
            </div>
            <Input label="Company Name" required value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Acme Corp" />
            <Input label="Email" required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@acme.com" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 123-4567" />
              <Input label="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Website" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}>
                {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Select label="Owner" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ConvertLeadModal({ lead, accounts, users, onCancel, onConvert }: {
  lead: Lead;
  accounts: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onConvert: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [accountId, setAccountId] = useState('');
  const [newAccount, setNewAccount] = useState({ name: lead.company_name, industry: '', website: '' });
  const [firstName, setFirstName] = useState(lead.first_name);
  const [lastName, setLastName] = useState(lead.last_name);
  const [email, setEmail] = useState(lead.email);
  const [phone, setPhone] = useState(lead.phone || '');
  const [title, setTitle] = useState('');
  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (mode === 'existing' && !accountId) { toast.error('Select an account'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        account_id: mode === 'existing' ? accountId : undefined,
        create_opportunity: createOpportunity,
        account: mode === 'new' ? {
          name: newAccount.name.trim() || lead.company_name,
          industry: newAccount.industry.trim() || undefined,
          website: newAccount.website.trim() || undefined,
          owner_id: lead.owner_id,
        } : undefined,
        contact: {
          first_name: firstName.trim() || lead.first_name,
          last_name: lastName.trim() || lead.last_name,
          email: email.trim() || lead.email,
          phone: phone.trim() || undefined,
          title: title.trim() || undefined,
        },
      };
      await onConvert(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Convert Lead"
      subtitle={`${lead.first_name} ${lead.last_name} — ${lead.company_name}`}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} loading={submitting} icon={<Sparkles className="w-3.5 h-3.5" />}>Convert Lead</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Account */}
        <div>
          <p className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-2">Account</p>
          <div className="flex items-center gap-1 bg-theme-inset border border-theme-border rounded-lg p-0.5 w-fit mb-3">
            <button
              onClick={() => setMode('existing')}
              className={`px-3 h-7 text-2xs font-semibold rounded-md cursor-pointer border-none ${mode === 'existing' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
            >
              Existing account
            </button>
            <button
              onClick={() => setMode('new')}
              className={`px-3 h-7 text-2xs font-semibold rounded-md cursor-pointer border-none ${mode === 'new' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
            >
              New account
            </button>
          </div>
          {mode === 'existing' ? (
            <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" required value={newAccount.name} onChange={e => setNewAccount(n => ({ ...n, name: e.target.value }))} />
              <Input label="Industry" value={newAccount.industry} onChange={e => setNewAccount(n => ({ ...n, industry: e.target.value }))} />
              <Input label="Website" className="col-span-2" value={newAccount.website} onChange={e => setNewAccount(n => ({ ...n, website: e.target.value }))} placeholder="https://" />
            </div>
          )}
        </div>

        {/* Contact */}
        <div>
          <p className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-2">Contact</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} />
            <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            <Input label="Title" className="col-span-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Head of Sales" />
          </div>
        </div>

        {/* Opportunity (optional but standard) */}
        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createOpportunity}
              onChange={e => setCreateOpportunity(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[color:var(--accent)] cursor-pointer"
            />
            <span className="text-xs text-theme-primary font-sans">
              Create an active sales opportunity?{' '}
              <span className="text-theme-secondary">
                (adds &quot;{lead.company_name} - Default Opportunity&quot; to the pipeline, linked to the account)
              </span>
            </span>
          </label>
        </div>

        <p className="text-2xs text-theme-secondary font-sans">
          Converting moves this lead out of the staging area: it creates a contact linked to the account,
          marks the lead as converted (the lead is archived, never deleted), and records a
          &quot;lead converted&quot; activity on both records.
        </p>
      </div>
    </Modal>
  );
}
